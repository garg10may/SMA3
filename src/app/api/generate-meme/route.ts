import { randomUUID } from "node:crypto";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import { createOpenAIClient } from "@/lib/openai-server";
import { maybeParseResponse } from "openai/lib/ResponsesParser";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import {
  buildMemegenImageUrl,
  DEFAULT_MEMEGEN_API_BASE_URL,
  type MemeTemplate,
  getMemeTemplateBlankUrl,
  getMemeTemplateCatalog,
  normalizeMemeLines,
} from "@/lib/meme-agent";
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

type MemePlan = {
  templateId: string;
  title: string;
  why: string;
  lines: string[];
};

type TemplateSelectionPlan = {
  memeAngle: string;
  why: string;
  templateIds: string[];
};

type ResolvedMemeResult = {
  format: "meme";
  template: {
    id: string;
    name: string;
    lineCount: number;
    helper: string;
  };
  title: string;
  rationale: string;
  lines: string[];
  imageUrl: string;
  blankUrl: string;
  model: TextModelOption;
  reasoningEffort: ReasoningEffortOption;
  requestId: string;
  fallback?: boolean;
};

const DEFAULT_TEMPLATE_CANDIDATES = [
  "drake",
  "same",
  "fine",
  "rollsafe",
  "buzz",
  "cmm",
  "both",
  "grusplan",
  "patrick",
  "spongebob",
  "facepalm",
] as const;

const MODEL_SHORTLIST_COUNT = 8;
const PLANNER_CANDIDATE_TARGET = 18;
const TEMPLATE_SELECTION_SCHEMA = {
  type: "json_schema" as const,
  name: "meme_template_selection",
  strict: true,
  description: "Semantic shortlist of Memegen template ids for a post.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      memeAngle: { type: "string" },
      why: { type: "string" },
      templateIds: {
        type: "array",
        items: { type: "string" },
        minItems: MODEL_SHORTLIST_COUNT,
        maxItems: MODEL_SHORTLIST_COUNT,
      },
    },
    required: ["memeAngle", "why", "templateIds"],
  },
};
const MEME_PLAN_SCHEMA = {
  type: "json_schema" as const,
  name: "meme_plan",
  strict: true,
  description: "A Memegen plan with one template id and caption lines.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      templateId: { type: "string" },
      title: { type: "string" },
      why: { type: "string" },
      lines: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 4,
      },
    },
    required: ["templateId", "title", "why", "lines"],
  },
};

type ParseableTextFormat<T> = {
  __output: T;
  $brand: "auto-parseable-response-format";
  $parseRaw(content: string): T;
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

const TEMPLATE_SELECTION_FORMAT =
  makeParseableTextFormat<TemplateSelectionPlan>(TEMPLATE_SELECTION_SCHEMA);
const MEME_PLAN_FORMAT = makeParseableTextFormat<MemePlan>(MEME_PLAN_SCHEMA);

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
          "api.generate-meme.openai",
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
          "api.generate-meme.openai",
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
        "api.generate-meme.openai",
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

function sanitizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 42);
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
  templateId?: string;
  candidateCount?: number;
  memeAngle?: string;
}) {
  const parts = [
    `post="${summarizeText(input.content, 72)}"`,
    input.direction ? `dir="${summarizeText(input.direction, 40)}"` : null,
    `tone=${input.tone}`,
    input.templateId ? `template=${input.templateId}` : "template=auto",
    typeof input.candidateCount === "number" ? `candidates=${input.candidateCount}` : null,
    input.memeAngle ? `angle="${summarizeText(input.memeAngle, 32)}"` : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function summarizeTemplateSelectionOutput(value: TemplateSelectionPlan) {
  return `angle="${summarizeText(value.memeAngle, 32)}" ids=${value.templateIds.join(",")}`;
}

function summarizeMemePlanOutput(value: MemePlan) {
  return `template=${value.templateId} title="${summarizeText(value.title, 28)}" lines="${value.lines
    .filter(Boolean)
    .map((line) => summarizeText(line, 20))
    .join(" | ")}"`;
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

  const words = normalized.split(" ").slice(0, maxWords);
  return sanitizeLine(words.join(" "));
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

function describeTemplate(template: MemeTemplate) {
  const keywordSummary =
    template.keywords.length > 0 ? template.keywords.slice(0, 4).join(", ") : "general reaction";

  return `${template.lines} line${template.lines === 1 ? "" : "s"} · keywords: ${keywordSummary}`;
}

function describeTemplateForSelector(template: MemeTemplate) {
  const keywordSummary =
    template.keywords.length > 0 ? template.keywords.slice(0, 6).join(", ") : "general reaction";
  const sourceSummary = template.source?.trim() ? template.source.trim() : "unknown";

  return `${template.id} | ${template.name} | ${template.lines} line${
    template.lines === 1 ? "" : "s"
  } | keywords: ${keywordSummary} | source: ${sourceSummary}`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreTemplate(template: MemeTemplate, tokens: string[]) {
  const idTokens = tokenize(template.id);
  const nameTokens = tokenize(template.name);
  const keywordTokens = template.keywords.flatMap((keyword) => tokenize(keyword));
  const searchable = new Set([...idTokens, ...nameTokens, ...keywordTokens]);

  let score = 0;

  for (const token of tokens) {
    if (template.id === token) {
      score += 20;
    }

    if (nameTokens.includes(token)) {
      score += 8;
    }

    if (keywordTokens.includes(token)) {
      score += 10;
    }

    if (Array.from(searchable).some((entry) => entry.includes(token))) {
      score += 3;
    }
  }

  if (template.lines <= 2) {
    score += 1;
  }

  return score;
}

function selectHeuristicTemplateCandidates(
  templates: MemeTemplate[],
  content: string,
  direction: string,
  templateOverride: string,
) {
  if (templateOverride) {
    const overrideTemplate = templates.find((template) => template.id === templateOverride);
    return overrideTemplate ? [overrideTemplate] : [];
  }

  const queryTokens = tokenize(`${content} ${direction}`);
  const scoredTemplates = templates
    .map((template) => ({
      template,
      score: scoreTemplate(template, queryTokens),
    }))
    .sort((left, right) => right.score - left.score || left.template.name.localeCompare(right.template.name));

  const selected = new Map<string, MemeTemplate>();

  for (const templateId of DEFAULT_TEMPLATE_CANDIDATES) {
    const template = templates.find((entry) => entry.id === templateId);

    if (template) {
      selected.set(template.id, template);
    }
  }

  for (const item of scoredTemplates) {
    if (selected.size >= 28) {
      break;
    }

    if (item.score <= 0 && selected.size >= 16) {
      continue;
    }

    selected.set(item.template.id, item.template);
  }

  if (selected.size === 0) {
    for (const template of templates.slice(0, 20)) {
      selected.set(template.id, template);
    }
  }

  return Array.from(selected.values());
}

function normalizeTemplateSelectionPlan(value: unknown): TemplateSelectionPlan {
  if (typeof value !== "object" || value === null) {
    throw new Error("Template selector output must be an object.");
  }

  const memeAngle =
    "memeAngle" in value && typeof value.memeAngle === "string"
      ? value.memeAngle.trim()
      : "";
  const why =
    "why" in value && typeof value.why === "string" ? value.why.trim() : "";
  const templateIds =
    "templateIds" in value && Array.isArray(value.templateIds)
      ? value.templateIds
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean)
      : [];

  if (!memeAngle || !why || templateIds.length === 0) {
    throw new Error("Template selector output is missing required fields.");
  }

  return {
    memeAngle,
    why,
    templateIds: Array.from(new Set(templateIds)),
  };
}

function mergeTemplateCandidates(
  templates: MemeTemplate[],
  preferredTemplateIds: string[],
  heuristicTemplates: MemeTemplate[],
) {
  const merged = new Map<string, MemeTemplate>();

  for (const templateId of preferredTemplateIds) {
    const template = templates.find((entry) => entry.id === templateId);

    if (template) {
      merged.set(template.id, template);
    }
  }

  for (const template of heuristicTemplates) {
    if (merged.size >= PLANNER_CANDIDATE_TARGET) {
      break;
    }

    merged.set(template.id, template);
  }

  return Array.from(merged.values());
}

function chooseFallbackTemplate(
  templates: MemeTemplate[],
  content: string,
  templateOverride: string,
) {
  if (templateOverride) {
    const overrideTemplate = templates.find((template) => template.id === templateOverride);

    if (overrideTemplate) {
      return overrideTemplate;
    }
  }

  const normalized = content.toLowerCase();
  const find = (templateId: string) =>
    templates.find((template) => template.id === templateId) ?? null;

  if (/\b(both|either|and also|why not)\b/.test(normalized)) {
    return find("both");
  }

  if (/\b(not sure|confused|unclear|maybe)\b/.test(normalized)) {
    return find("fry");
  }

  if (/\b(regret|mistake|bad choice|backfired|oops)\b/.test(normalized)) {
    return find("badchoice");
  }

  if (/\b(opinion|take|hot take|debate|argue)\b/.test(normalized)) {
    return find("cmm");
  }

  if (/\b(too many|everywhere|all over|flood|flooded|spam)\b/.test(normalized)) {
    return find("buzz");
  }

  return find("buzz");
}

function buildFallbackPlan(
  templates: MemeTemplate[],
  content: string,
  templateOverride: string,
): MemePlan {
  const template = chooseFallbackTemplate(templates, content, templateOverride);

  if (!template) {
    throw new Error("No fallback meme template is available.");
  }

  const { first, second } = splitContent(content);
  const subject = summarizeFragment(first, 5, "This idea");
  const outcome = summarizeFragment(second || content, 6, "Now we are here");

  let lines: string[];

  switch (template.id) {
    case "both":
      lines = [subject, "why not both?"];
      break;
    case "cmm":
      lines = [summarizeFragment(content, 7, "This is the take")];
      break;
    case "fry":
      lines = [
        `not sure if ${subject.toLowerCase()}`,
        outcome.toLowerCase(),
      ];
      break;
    case "badchoice":
      lines = [subject, "was a bad choice"];
      break;
    default:
      lines = [subject, `${outcome || "everywhere"} everywhere`];
      break;
  }

  return {
    templateId: template.id,
    title: "fallback meme plan",
    why: "The planner failed, so the app used a local heuristic to keep the meme flow working.",
    lines,
  };
}

function buildMemeResult(
  templates: MemeTemplate[],
  plan: MemePlan,
  requestId: string,
  templateOverride: string,
  model: TextModelOption,
  reasoningEffort: ReasoningEffortOption,
  fallback = false,
): ResolvedMemeResult {
  const templateId =
    templateOverride && templates.some((template) => template.id === templateOverride)
      ? templateOverride
      : templates.some((template) => template.id === plan.templateId)
        ? plan.templateId
        : "";

  if (!templateId) {
    throw new Error("The planner returned an unknown meme template.");
  }

  const template = templates.find((entry) => entry.id === templateId) ?? null;

  if (!template) {
    throw new Error("The selected meme template is missing from the catalog.");
  }

  const lines = normalizeMemeLines(
    Array.isArray(plan.lines)
      ? plan.lines.map((line) => sanitizeLine(String(line)))
      : [],
    template.lines,
  );

  return {
    format: "meme",
    template: {
      id: template.id,
      name: template.name,
      lineCount: template.lines,
      helper: describeTemplate(template),
    },
    title: plan.title?.trim() || template.name,
    rationale: plan.why?.trim() || describeTemplate(template),
    lines,
    imageUrl: buildMemegenImageUrl(template.id, lines, {
      baseUrl: DEFAULT_MEMEGEN_API_BASE_URL,
      width: 1200,
      font: "impact",
    }),
    blankUrl: getMemeTemplateBlankUrl(template.id),
    model,
    reasoningEffort,
    requestId,
    fallback,
  };
}

function buildPlannerPrompt(input: {
  templates: MemeTemplate[];
  content: string;
  direction: string;
  tonePrompt: string;
  templateOverride: string;
  memeAngle?: string;
  templateSelectionWhy?: string;
}) {
  const catalog = input.templates
    .map(
      (template) =>
        `- ${template.id} | ${template.name} | ${describeTemplate(template)} | styles: ${template.styles.join(", ") || "none"}`,
    )
    .join("\n");

  const overrideLine = input.templateOverride
    ? `Template override: You must use template "${input.templateOverride}".`
    : "Template override: none. Choose the best fit from the catalog.";
  const selectorContext = input.memeAngle
    ? [
        `Selector read on the post:\n${input.memeAngle}`,
        "",
        input.templateSelectionWhy
          ? `Why these candidates were shortlisted:\n${input.templateSelectionWhy}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Selector read on the post:\nNone";

  return [
    "Choose one meme template and write tight meme copy for it.",
    "",
    "Rules:",
    "- Choose exactly one template from the catalog.",
    "- The title should be a short internal label, not a social caption.",
    "- The why field must be one sentence explaining why the template fits.",
    "- Keep each non-empty line under 42 characters.",
    "- Use empty strings for any intentionally blank lines.",
    "- No hashtags, no emojis, no quotation marks around the lines unless needed for the joke.",
    "- Keep the copy internet-native and specific, not generic marketing language.",
    "- Avoid slurs, sexual content, graphic violence, or tragedy jokes.",
    "",
    overrideLine,
    "",
    `Post context:\n${input.content}`,
    "",
    input.direction
      ? `Extra direction:\n${input.direction}`
      : "Extra direction:\nNone",
    "",
    selectorContext,
    "",
    `Tone:\n${input.tonePrompt}`,
    "",
    "Template catalog:",
    catalog,
  ].join("\n");
}

function buildTemplateSelectionPrompt(input: {
  templates: MemeTemplate[];
  content: string;
  direction: string;
  tonePrompt: string;
}) {
  const catalog = input.templates.map(describeTemplateForSelector).join("\n");

  return [
    "Infer the meme situation from the post, then shortlist live Memegen templates that fit it.",
    "",
    "Rules:",
    `- Return ${MODEL_SHORTLIST_COUNT} unique templateIds from the catalog.`,
    "- Base the shortlist on meme semantics, not just literal word overlap.",
    "- Prefer broadly recognizable, strong-fit templates over obscure ones unless the match is clearly better.",
    "- Include templates that would give the caption writer distinct comedic angles, not near-duplicates only.",
    "- Keep memeAngle under 18 words.",
    "- Keep why to one sentence.",
    "",
    `Post context:\n${input.content}`,
    "",
    input.direction
      ? `Extra direction:\n${input.direction}`
      : "Extra direction:\nNone",
    "",
    `Tone:\n${input.tonePrompt}`,
    "",
    "Live template catalog:",
    catalog,
  ].join("\n");
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return finalizeJsonResponse(
      "api.generate-meme",
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

  const rawTemplateId =
    typeof payload === "object" &&
    payload !== null &&
    "templateId" in payload &&
    typeof payload.templateId === "string"
      ? payload.templateId.trim()
      : "";

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
      "api.generate-meme",
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
  const templates = await getMemeTemplateCatalog();
  const heuristicTemplates = selectHeuristicTemplateCandidates(
    templates,
    rawContent,
    rawDirection,
    rawTemplateId,
  );

  if (rawTemplateId && !templates.some((template) => template.id === rawTemplateId)) {
    return finalizeJsonResponse(
      "api.generate-meme",
      request,
      startedAt,
      {
        error: "The selected meme template is not available in the live memegen catalog.",
        requestId,
      },
      { status: 400 },
      { requestId, templateId: rawTemplateId },
    );
  }

  try {
    let templateSelection: TemplateSelectionPlan | null = null;
    let candidateTemplates = heuristicTemplates;

    if (!rawTemplateId) {
      try {
        templateSelection = normalizeTemplateSelectionPlan(
          await requestStructuredOutput<TemplateSelectionPlan>([
            {
              label: "Template selector",
              summarizeInput: summarizeOpenAIInput({
                content: rawContent,
                direction: rawDirection,
                tone,
              }),
              summarizeOutput: summarizeTemplateSelectionOutput,
              params: {
                model,
                max_output_tokens: 600,
                reasoning: { effort: reasoningEffort },
                text: {
                  format: TEMPLATE_SELECTION_FORMAT,
                },
                input: [
                  {
                    role: "system",
                    content: [
                      {
                        type: "input_text",
                        text: "You shortlist live memegen templates. Return strict JSON only.",
                      },
                    ],
                  },
                  {
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: buildTemplateSelectionPrompt({
                          templates,
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
              label: "Template selector retry",
              summarizeInput: summarizeOpenAIInput({
                content: rawContent,
                direction: rawDirection,
                tone,
              }),
              summarizeOutput: summarizeTemplateSelectionOutput,
              params: {
                model,
                max_output_tokens: 1200,
                reasoning: { effort: "low" },
                text: {
                  format: TEMPLATE_SELECTION_FORMAT,
                },
                input: [
                  {
                    role: "system",
                    content: [
                      {
                        type: "input_text",
                        text: "You shortlist live memegen templates. Return strict JSON only.",
                      },
                    ],
                  },
                  {
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: buildTemplateSelectionPrompt({
                          templates,
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

        candidateTemplates = mergeTemplateCandidates(
          templates,
          templateSelection.templateIds,
          heuristicTemplates,
        );
      } catch (selectionError) {
        logWarn("api.generate-meme", "Template selection failed, using heuristic shortlist", {
          tone,
          error:
            selectionError instanceof Error
              ? selectionError.message
              : String(selectionError),
        });
        candidateTemplates = heuristicTemplates;
      }
    }

    const plan = await requestStructuredOutput<MemePlan>([
      {
        label: "Meme planner",
        summarizeInput: summarizeOpenAIInput({
          content: rawContent,
          direction: rawDirection,
          tone,
          templateId: rawTemplateId || undefined,
          candidateCount: candidateTemplates.length,
          memeAngle: templateSelection?.memeAngle,
        }),
        summarizeOutput: summarizeMemePlanOutput,
        params: {
          model,
          max_output_tokens: 700,
          reasoning: { effort: reasoningEffort },
          text: {
            format: MEME_PLAN_FORMAT,
          },
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: "You write meme captions for memegen templates. Return strict JSON only.",
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildPlannerPrompt({
                    templates: candidateTemplates,
                    content: rawContent,
                    direction: rawDirection,
                    tonePrompt: getTonePrompt(tone),
                    templateOverride: rawTemplateId,
                    memeAngle: templateSelection?.memeAngle,
                    templateSelectionWhy: templateSelection?.why,
                  }),
                },
              ],
            },
          ],
        },
      },
      {
        label: "Meme planner retry",
        summarizeInput: summarizeOpenAIInput({
          content: rawContent,
          direction: rawDirection,
          tone,
          templateId: rawTemplateId || undefined,
          candidateCount: candidateTemplates.length,
          memeAngle: templateSelection?.memeAngle,
        }),
        summarizeOutput: summarizeMemePlanOutput,
        params: {
          model,
          max_output_tokens: 1200,
          reasoning: { effort: "low" },
          text: {
            format: MEME_PLAN_FORMAT,
          },
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: "You write meme captions for memegen templates. Return strict JSON only.",
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildPlannerPrompt({
                    templates: candidateTemplates,
                    content: rawContent,
                    direction: rawDirection,
                    tonePrompt: getTonePrompt(tone),
                    templateOverride: rawTemplateId,
                    memeAngle: templateSelection?.memeAngle,
                    templateSelectionWhy: templateSelection?.why,
                  }),
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = buildMemeResult(
      templates,
      plan,
      requestId,
      rawTemplateId,
      model,
      reasoningEffort,
    );

    return finalizeJsonResponse(
      "api.generate-meme",
      request,
      startedAt,
      result,
      undefined,
      {
        requestId,
        templateId: result.template.id,
        tone,
        model,
        reasoningEffort,
        fallback: false,
      },
    );
  } catch (error) {
    logWarn("api.generate-meme", "Meme planning failed, using fallback", {
      tone,
      templateId: rawTemplateId || undefined,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const fallbackPlan = buildFallbackPlan(templates, rawContent, rawTemplateId);
      const fallbackResult = buildMemeResult(
        templates,
        fallbackPlan,
        requestId,
        rawTemplateId,
        model,
        reasoningEffort,
        true,
      );

      return finalizeJsonResponse(
        "api.generate-meme",
        request,
        startedAt,
        fallbackResult,
        undefined,
        {
          requestId,
          tone,
          model,
          reasoningEffort,
          templateId: fallbackResult.template.id,
          fallback: true,
        },
      );
    } catch (fallbackError) {
      logError("api.generate-meme", "Meme fallback failed", {
        tone,
        templateId: rawTemplateId || undefined,
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
      });

      return finalizeJsonResponse(
        "api.generate-meme",
        request,
        startedAt,
        {
          error: "The meme generator could not plan a meme right now.",
          requestId,
        },
        { status: 500 },
        {
          requestId,
          tone,
          model,
          reasoningEffort,
          templateId: rawTemplateId || undefined,
        },
      );
    }
  }
}
