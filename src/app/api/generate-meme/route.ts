import { randomUUID } from "node:crypto";
import { logError, logWarn } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import { createOpenAIClient } from "@/lib/openai-server";
import {
  buildMemegenImageUrl,
  DEFAULT_MEMEGEN_API_BASE_URL,
  getMemeTemplate,
  getMemeTemplateBlankUrl,
  isMemeTemplateId,
  memeTemplateCatalog,
  normalizeMemeLines,
} from "@/lib/meme-agent";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TONE,
  getTonePrompt,
  isToneOption,
  MAX_BRIEF_LENGTH,
} from "@/lib/post-config";

export const runtime = "nodejs";

type MemePlan = {
  templateId: string;
  title: string;
  why: string;
  lines: string[];
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
  requestId: string;
  fallback?: boolean;
};

function extractJsonObject(text: string) {
  const fencedBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedBlock?.[1] ?? text;
  return JSON.parse(candidate) as MemePlan;
}

function sanitizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 42);
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

function chooseFallbackTemplate(content: string, templateOverride: string) {
  if (templateOverride && isMemeTemplateId(templateOverride)) {
    return getMemeTemplate(templateOverride);
  }

  const normalized = content.toLowerCase();

  if (/\b(both|either|and also|why not)\b/.test(normalized)) {
    return getMemeTemplate("both");
  }

  if (/\b(not sure|confused|unclear|maybe)\b/.test(normalized)) {
    return getMemeTemplate("fry");
  }

  if (/\b(regret|mistake|bad choice|backfired|oops)\b/.test(normalized)) {
    return getMemeTemplate("badchoice");
  }

  if (/\b(opinion|take|hot take|debate|argue)\b/.test(normalized)) {
    return getMemeTemplate("cmm");
  }

  if (/\b(too many|everywhere|all over|flood|flooded|spam)\b/.test(normalized)) {
    return getMemeTemplate("buzz");
  }

  return getMemeTemplate("buzz");
}

function buildFallbackPlan(content: string, templateOverride: string): MemePlan {
  const template = chooseFallbackTemplate(content, templateOverride);

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
  plan: MemePlan,
  requestId: string,
  templateOverride: string,
  fallback = false,
): ResolvedMemeResult {
  const templateId =
    templateOverride && isMemeTemplateId(templateOverride)
      ? templateOverride
      : isMemeTemplateId(plan.templateId)
        ? plan.templateId
        : "";

  if (!templateId) {
    throw new Error("The planner returned an unknown meme template.");
  }

  const template = getMemeTemplate(templateId);

  if (!template) {
    throw new Error("The selected meme template is missing from the catalog.");
  }

  const lines = normalizeMemeLines(
    Array.isArray(plan.lines)
      ? plan.lines.map((line) => sanitizeLine(String(line)))
      : [],
    template.lineCount,
  );

  return {
    format: "meme",
    template: {
      id: template.id,
      name: template.name,
      lineCount: template.lineCount,
      helper: template.helper,
    },
    title: plan.title?.trim() || template.name,
    rationale: plan.why?.trim() || template.helper,
    lines,
    imageUrl: buildMemegenImageUrl(template.id, lines, {
      baseUrl: DEFAULT_MEMEGEN_API_BASE_URL,
      width: 1200,
      font: "impact",
    }),
    blankUrl: getMemeTemplateBlankUrl(template.id),
    requestId,
    fallback,
  };
}

function buildPlannerPrompt(input: {
  content: string;
  direction: string;
  tonePrompt: string;
  templateOverride: string;
}) {
  const catalog = memeTemplateCatalog
    .map(
      (template) =>
        `- ${template.id} | ${template.name} | ${template.lineCount} lines | ${template.helper} | keywords: ${template.keywords.join(", ")}`,
    )
    .join("\n");

  const overrideLine = input.templateOverride
    ? `Template override: You must use template "${input.templateOverride}".`
    : "Template override: none. Choose the best fit from the catalog.";

  return [
    "Choose one meme template and write tight meme copy for it.",
    "",
    "Return only valid JSON with this shape:",
    '{ "templateId": "...", "title": "...", "why": "...", "lines": ["...", "..."] }',
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
    `Tone:\n${input.tonePrompt}`,
    "",
    "Template catalog:",
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

  if (rawTemplateId && !isMemeTemplateId(rawTemplateId)) {
    return finalizeJsonResponse(
      "api.generate-meme",
      request,
      startedAt,
      {
        error: "The selected meme template is not supported in this build.",
        requestId,
      },
      { status: 400 },
      { requestId, templateId: rawTemplateId },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;

  try {
    const openai = createOpenAIClient();
    const response = await openai.responses.create({
      model: DEFAULT_MODEL,
      max_output_tokens: 500,
      reasoning: { effort: DEFAULT_REASONING_EFFORT },
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
                content: rawContent,
                direction: rawDirection,
                tonePrompt: getTonePrompt(tone),
                templateOverride: rawTemplateId,
              }),
            },
          ],
        },
      ],
    });

    const plan = extractJsonObject(response.output_text.trim());
    const result = buildMemeResult(plan, requestId, rawTemplateId);

    return finalizeJsonResponse(
      "api.generate-meme",
      request,
      startedAt,
      result,
      undefined,
      { requestId, templateId: result.template.id, tone, fallback: false },
    );
  } catch (error) {
    logWarn("api.generate-meme", "Meme planning failed, using fallback", {
      requestId,
      tone,
      templateId: rawTemplateId || undefined,
      error,
    });

    try {
      const fallbackPlan = buildFallbackPlan(rawContent, rawTemplateId);
      const fallbackResult = buildMemeResult(
        fallbackPlan,
        requestId,
        rawTemplateId,
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
          templateId: fallbackResult.template.id,
          fallback: true,
        },
      );
    } catch (fallbackError) {
      logError("api.generate-meme", "Meme fallback failed", {
        requestId,
        tone,
        templateId: rawTemplateId || undefined,
        error: fallbackError,
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
        { requestId, tone, templateId: rawTemplateId || undefined },
      );
    }
  }
}
