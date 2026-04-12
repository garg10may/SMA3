import { randomUUID } from "node:crypto";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import { createOpenAIClient } from "@/lib/openai-server";
import { maybeParseResponse } from "openai/lib/ResponsesParser";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import {
  buildReactionMemeImageUrl,
  getReactionCatalog,
  getReactionCatalogEntry,
  sanitizeReactionCaption,
  searchReactionCatalog,
  type ReactionCatalogEntry,
} from "@/lib/reaction-catalog";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TONE,
  getTonePrompt,
  isReasoningEffortOption,
  isTextModelOption,
  isToneOption,
  MAX_BRIEF_LENGTH,
  type ReasoningEffortOption,
  type TextModelOption,
} from "@/lib/post-config";

export const runtime = "nodejs";

type ReactionPlan = {
  reactionId: string;
  title: string;
  why: string;
  caption: string;
};

type ReactionPlanBatch = {
  variants: ReactionPlan[];
};

type ResolvedReactionVariant = {
  reaction: {
    id: string;
    name: string;
    intensity: string;
    helper: string;
    emotionTags: string[];
    situationTags: string[];
  };
  title: string;
  rationale: string;
  caption: string;
  imageUrl: string;
  sourceImageUrl: string;
};

type ResolvedReactionResult = {
  format: "reaction";
  variants: ResolvedReactionVariant[];
  model: TextModelOption;
  reasoningEffort: ReasoningEffortOption;
  requestId: string;
  fallback?: boolean;
};

type ParseableTextFormat<T> = {
  __output: T;
  $brand: "auto-parseable-response-format";
  $parseRaw(content: string): T;
};

const REACTION_VARIANT_COUNT = 3;
const REACTION_PLAN_SCHEMA = {
  type: "json_schema" as const,
  name: "reaction_meme_plan_batch",
  strict: true,
  description: "Three reaction meme variants with local reaction image ids and captions.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      variants: {
        type: "array",
        minItems: REACTION_VARIANT_COUNT,
        maxItems: REACTION_VARIANT_COUNT,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            reactionId: { type: "string" },
            title: { type: "string" },
            why: { type: "string" },
            caption: { type: "string" },
          },
          required: ["reactionId", "title", "why", "caption"],
        },
      },
    },
    required: ["variants"],
  },
};

function makeParseableTextFormat<T>(schema: {
  type: "json_schema";
  name: string;
  strict: boolean;
  description?: string;
  schema: Record<string, unknown>;
}) {
  const format = { ...schema };

  Object.defineProperties(format, {
    $brand: {
      value: "auto-parseable-response-format",
      enumerable: false,
    },
    $parseRaw: {
      value: (content: string) => JSON.parse(content) as T,
      enumerable: false,
    },
  });

  return format as typeof schema & ParseableTextFormat<T>;
}

const REACTION_PLAN_FORMAT =
  makeParseableTextFormat<ReactionPlanBatch>(REACTION_PLAN_SCHEMA);

async function requestStructuredOutput<T>(
  requests: Array<{
    label: string;
    params: ResponseCreateParamsNonStreaming;
    summarizeInput?: string;
    summarizeOutput?: (value: T) => string;
  }>,
) {
  let lastError: Error | null = null;

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const startedAt = performance.now();

    try {
      const response = await createOpenAIClient().responses.create({
        ...request.params,
        stream: false,
      });
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

      if (response.status === "incomplete") {
        const reason = response.incomplete_details?.reason ?? "unknown";
        logWarn(
          "api.generate-reaction-meme.openai",
          `${request.label} attempt=${index + 1} incomplete ${durationMs.toFixed(2)}ms`,
          {
            reason,
            input: request.summarizeInput,
          },
        );
        lastError = new Error(`${request.label} incomplete: ${reason}`);
        continue;
      }

      if (response.status === "failed") {
        const message = response.error?.message ?? "unknown";
        throw new Error(`${request.label} failed: ${message}`);
      }

      const parsedResponse = maybeParseResponse(response, request.params);
      const parsed = parsedResponse.output_parsed as T | null;

      if (parsed !== null) {
        logInfo(
          "api.generate-reaction-meme.openai",
          `${request.label} attempt=${index + 1} ${durationMs.toFixed(2)}ms`,
          {
            input: request.summarizeInput,
            output: request.summarizeOutput?.(parsed),
          },
        );
        return parsed;
      }

      lastError = new Error(`${request.label} returned no parsed output.`);
    } catch (error) {
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      logWarn(
        "api.generate-reaction-meme.openai",
        `${request.label} attempt=${index + 1} failed ${durationMs.toFixed(2)}ms`,
        {
          input: request.summarizeInput,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Structured output request failed.");
}

function summarizeText(value: string, maxLength: number) {
  const collapsed = value.replace(/\s+/g, " ").trim();

  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function summarizeOpenAIInput(input: {
  content: string;
  direction: string;
  tone: string;
  candidateCount: number;
}) {
  const parts = [
    `post="${summarizeText(input.content, 72)}"`,
    input.direction ? `dir="${summarizeText(input.direction, 40)}"` : null,
    `tone=${input.tone}`,
    `candidates=${input.candidateCount}`,
  ].filter(Boolean);

  return parts.join(" ");
}

function summarizeReactionPlanOutput(value: ReactionPlanBatch) {
  return `reactions=${value.variants.map((variant) => variant.reactionId).join(",")} captions="${value.variants
    .map((variant) => summarizeText(variant.caption, 20))
    .join(" | ")}"`;
}

function normalizeReactionPlanBatch(value: unknown): ReactionPlanBatch {
  if (typeof value !== "object" || value === null) {
    throw new Error("Reaction planner output must be an object.");
  }

  const variants =
    "variants" in value && Array.isArray(value.variants)
      ? value.variants
          .map((entry) => {
            if (typeof entry !== "object" || entry === null) {
              return null;
            }

            const reactionId =
              "reactionId" in entry && typeof entry.reactionId === "string"
                ? entry.reactionId.trim()
                : "";
            const title =
              "title" in entry && typeof entry.title === "string"
                ? entry.title.trim()
                : "";
            const why =
              "why" in entry && typeof entry.why === "string"
                ? entry.why.trim()
                : "";
            const caption =
              "caption" in entry && typeof entry.caption === "string"
                ? sanitizeReactionCaption(entry.caption)
                : "";

            if (!reactionId || !title || !why || !caption) {
              return null;
            }

            return { reactionId, title, why, caption };
          })
          .filter((entry): entry is ReactionPlan => entry !== null)
      : [];

  if (variants.length < REACTION_VARIANT_COUNT) {
    throw new Error("Reaction planner returned too few variants.");
  }

  const uniqueVariants: ReactionPlan[] = [];

  for (const variant of variants) {
    if (
      uniqueVariants.some(
        (entry) => entry.reactionId.toLowerCase() === variant.reactionId.toLowerCase(),
      )
    ) {
      continue;
    }

    uniqueVariants.push(variant);

    if (uniqueVariants.length >= REACTION_VARIANT_COUNT) {
      break;
    }
  }

  if (uniqueVariants.length < REACTION_VARIANT_COUNT) {
    throw new Error("Reaction planner returned duplicate reactions.");
  }

  return {
    variants: uniqueVariants,
  };
}

function summarizeFragment(value: string, maxWords: number, fallback: string) {
  const normalized = value
    .replace(/[“”"']/g, "")
    .replace(/[^\p{L}\p{N}\s,&!?-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.split(" ").slice(0, maxWords).join(" ");
}

function splitContent(content: string) {
  const parts = content
    .split(/[.!?;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    first: parts[0] ?? content.trim(),
    second: parts[1] ?? "",
  };
}

function describeReaction(entry: ReactionCatalogEntry) {
  return [
    `${entry.id} | ${entry.name}`,
    `intensity: ${entry.intensity}`,
    `emotions: ${entry.emotionTags.join(", ")}`,
    `situations: ${entry.situationTags.join(", ")}`,
    `search: ${entry.searchTerms.join(", ")}`,
    `helper: ${entry.helper}`,
  ].join(" | ");
}

function buildPlannerPrompt(input: {
  catalog: ReactionCatalogEntry[];
  content: string;
  direction: string;
  tonePrompt: string;
}) {
  const catalog = input.catalog.map(describeReaction).join("\n");

  return [
    "Choose three reaction images from the catalog and write top-caption reaction meme copy for each.",
    "",
    "Rules:",
    `- Create exactly ${REACTION_VARIANT_COUNT} variants.`,
    `- Use ${REACTION_VARIANT_COUNT} different reactionIds from the catalog.`,
    "- Each variant needs reactionId, title, why, and caption.",
    "- The title should be a short internal label, not a social caption.",
    "- The why field must be one sentence explaining why that reaction image fits.",
    "- The caption is top text only and should read like a reaction meme, not a tweet thread.",
    "- Keep the caption under 96 characters.",
    "- No hashtags, no emojis, no quote marks unless needed for the joke.",
    "- Keep the variants meaningfully different in emotional framing, not tiny rewrites.",
    "",
    `Post context:\n${input.content}`,
    "",
    input.direction
      ? `Extra direction:\n${input.direction}`
      : "Extra direction:\nNone",
    "",
    `Tone:\n${input.tonePrompt}`,
    "",
    "Reaction image catalog:",
    catalog,
  ].join("\n");
}

function buildFallbackCaption(
  content: string,
  direction: string,
  entry: ReactionCatalogEntry,
  index: number,
) {
  const { first, second } = splitContent(content);
  const firstFragment = summarizeFragment(first, 7, "we're all thinking it");
  const secondFragment = summarizeFragment(
    direction || second || content,
    7,
    "trying to stay normal",
  );

  switch (index) {
    case 0:
      return sanitizeReactionCaption(firstFragment);
    case 1:
      return sanitizeReactionCaption(`when ${secondFragment.toLowerCase()}`);
    default:
      if (entry.situationTags.includes("adult mode")) {
        return sanitizeReactionCaption("we're all thinking it. adult mode.");
      }

      return sanitizeReactionCaption(secondFragment);
  }
}

function buildFallbackPlanBatch(
  content: string,
  direction: string,
  catalog: ReactionCatalogEntry[],
) {
  const query = [content, direction].filter(Boolean).join(" ");
  const matched = searchReactionCatalog(query, {
    limit: 8,
    fallbackToPopular: true,
  }).items;
  const selected = matched.length > 0 ? matched : catalog.slice(0, REACTION_VARIANT_COUNT);
  const uniqueEntries: ReactionCatalogEntry[] = [];

  for (const entry of selected) {
    if (uniqueEntries.some((item) => item.id === entry.id)) {
      continue;
    }

    uniqueEntries.push(entry);

    if (uniqueEntries.length >= REACTION_VARIANT_COUNT) {
      break;
    }
  }

  return {
    variants: uniqueEntries.map((entry, index) => ({
      reactionId: entry.id,
      title: index === 0 ? entry.name : `${entry.name} take ${index + 1}`,
      why: entry.helper,
      caption: buildFallbackCaption(content, direction, entry, index),
    })),
  };
}

function buildReactionVariant(plan: ReactionPlan): ResolvedReactionVariant {
  const reaction = getReactionCatalogEntry(plan.reactionId);

  if (!reaction) {
    throw new Error("The planner returned an unknown reaction image.");
  }

  const caption = sanitizeReactionCaption(plan.caption);

  if (!caption) {
    throw new Error("The planner returned an empty reaction caption.");
  }

  return {
    reaction: {
      id: reaction.id,
      name: reaction.name,
      intensity: reaction.intensity,
      helper: reaction.helper,
      emotionTags: reaction.emotionTags,
      situationTags: reaction.situationTags,
    },
    title: plan.title || reaction.name,
    rationale: plan.why || reaction.helper,
    caption,
    imageUrl: buildReactionMemeImageUrl(reaction.id, caption),
    sourceImageUrl: reaction.imageUrl,
  };
}

function buildReactionResult(
  planBatch: ReactionPlanBatch,
  requestId: string,
  model: TextModelOption,
  reasoningEffort: ReasoningEffortOption,
  fallback = false,
): ResolvedReactionResult {
  return {
    format: "reaction",
    variants: planBatch.variants.map((plan) => buildReactionVariant(plan)),
    model,
    reasoningEffort,
    requestId,
    fallback,
  };
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return finalizeJsonResponse(
      "api.generate-reaction-meme",
      request,
      startedAt,
      { error: "The request body must be valid JSON.", requestId },
      { status: 400 },
      { requestId },
    );
  }

  const rawContent =
    typeof payload === "object" &&
    payload !== null &&
    "content" in payload &&
    typeof payload.content === "string"
      ? payload.content.trim()
      : "";

  const rawDirection =
    typeof payload === "object" &&
    payload !== null &&
    "direction" in payload &&
    typeof payload.direction === "string"
      ? payload.direction.trim()
      : "";

  const rawTone =
    typeof payload === "object" &&
    payload !== null &&
    "tone" in payload &&
    typeof payload.tone === "string"
      ? payload.tone
      : DEFAULT_TONE;

  const rawModel =
    typeof payload === "object" &&
    payload !== null &&
    "model" in payload &&
    typeof payload.model === "string"
      ? payload.model
      : DEFAULT_MODEL;

  const rawReasoningEffort =
    typeof payload === "object" &&
    payload !== null &&
    "reasoningEffort" in payload &&
    typeof payload.reasoningEffort === "string"
      ? payload.reasoningEffort
      : DEFAULT_REASONING_EFFORT;

  if (rawContent.length < 12 || rawContent.length > MAX_BRIEF_LENGTH) {
    return finalizeJsonResponse(
      "api.generate-reaction-meme",
      request,
      startedAt,
      {
        error: `Content must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;
  const model = isTextModelOption(rawModel) ? rawModel : DEFAULT_MODEL;
  const reasoningEffort = isReasoningEffortOption(rawReasoningEffort)
    ? rawReasoningEffort
    : DEFAULT_REASONING_EFFORT;
  const catalog = getReactionCatalog();

  try {
    const planBatch = normalizeReactionPlanBatch(
      await requestStructuredOutput<ReactionPlanBatch>([
        {
          label: "Reaction planner",
          summarizeInput: summarizeOpenAIInput({
            content: rawContent,
            direction: rawDirection,
            tone,
            candidateCount: catalog.length,
          }),
          summarizeOutput: summarizeReactionPlanOutput,
          params: {
            model,
            max_output_tokens: 900,
            reasoning: { effort: reasoningEffort },
            text: {
              format: REACTION_PLAN_FORMAT,
            },
            input: [
              {
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: "You write top-caption reaction memes grounded on a local reaction image catalog. Return strict JSON only.",
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: buildPlannerPrompt({
                      catalog,
                      content: rawContent,
                      direction: rawDirection,
                      tonePrompt: getTonePrompt(tone),
                    }),
                  },
                ],
              },
            ],
          },
        },
        {
          label: "Reaction planner retry",
          summarizeInput: summarizeOpenAIInput({
            content: rawContent,
            direction: rawDirection,
            tone,
            candidateCount: catalog.length,
          }),
          summarizeOutput: summarizeReactionPlanOutput,
          params: {
            model,
            max_output_tokens: 1400,
            reasoning: { effort: "low" },
            text: {
              format: REACTION_PLAN_FORMAT,
            },
            input: [
              {
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: "You write top-caption reaction memes grounded on a local reaction image catalog. Return strict JSON only.",
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: buildPlannerPrompt({
                      catalog,
                      content: rawContent,
                      direction: rawDirection,
                      tonePrompt: getTonePrompt(tone),
                    }),
                  },
                ],
              },
            ],
          },
        },
      ]),
    );

    const result = buildReactionResult(
      planBatch,
      requestId,
      model,
      reasoningEffort,
    );

    return finalizeJsonResponse(
      "api.generate-reaction-meme",
      request,
      startedAt,
      result,
      undefined,
      {
        requestId,
        reactionIds: result.variants.map((variant) => variant.reaction.id).join(","),
        tone,
        model,
        reasoningEffort,
        fallback: false,
      },
    );
  } catch (error) {
    logWarn("api.generate-reaction-meme", "Reaction planning failed, using fallback", {
      requestId,
      tone,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const fallbackPlanBatch = buildFallbackPlanBatch(rawContent, rawDirection, catalog);
      const fallbackResult = buildReactionResult(
        fallbackPlanBatch,
        requestId,
        model,
        reasoningEffort,
        true,
      );

      return finalizeJsonResponse(
        "api.generate-reaction-meme",
        request,
        startedAt,
        fallbackResult,
        undefined,
        {
          requestId,
          reactionIds: fallbackResult.variants
            .map((variant) => variant.reaction.id)
            .join(","),
          tone,
          model,
          reasoningEffort,
          fallback: true,
        },
      );
    } catch (fallbackError) {
      logError("api.generate-reaction-meme", "Reaction fallback failed", {
        requestId,
        tone,
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
      });

      return finalizeJsonResponse(
        "api.generate-reaction-meme",
        request,
        startedAt,
        {
          error: "The reaction meme generator could not plan a meme right now.",
          requestId,
        },
        { status: 500 },
        {
          requestId,
          tone,
          model,
          reasoningEffort,
        },
      );
    }
  }
}
