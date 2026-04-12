import { randomUUID } from "node:crypto";
import { logError, logWarn } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import { createOpenAIClient } from "@/lib/openai-server";
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

function describeTemplate(template: MemeTemplate) {
  const keywordSummary =
    template.keywords.length > 0 ? template.keywords.slice(0, 4).join(", ") : "general reaction";

  return `${template.lines} line${template.lines === 1 ? "" : "s"} · keywords: ${keywordSummary}`;
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

function selectTemplateCandidates(
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

function buildPlannerRepairPrompt(input: {
  templates: MemeTemplate[];
  rawOutput: string;
}) {
  const allowedIds = input.templates.map((template) => template.id).join(", ");

  return [
    "Convert the previous meme-planner output into strict JSON.",
    'Return only valid JSON with this shape: { "templateId": "...", "title": "...", "why": "...", "lines": ["...", "..."] }',
    `Allowed template ids: ${allowedIds}`,
    "Rules:",
    "- Keep templateId to one allowed value only.",
    "- Keep each non-empty line under 42 characters.",
    "- Preserve the original intent if possible.",
    "- If the original output is unusable, infer the best valid JSON from it.",
    "",
    "Original output:",
    input.rawOutput,
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
  const candidateTemplates = selectTemplateCandidates(
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
    const openai = createOpenAIClient();
    const response = await openai.responses.create({
      model,
      max_output_tokens: 500,
      reasoning: { effort: reasoningEffort },
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
              }),
            },
          ],
        },
      ],
    });

    let result: ResolvedMemeResult;

    try {
      const plan = extractJsonObject(response.output_text.trim());
      result = buildMemeResult(
        templates,
        plan,
        requestId,
        rawTemplateId,
        model,
        reasoningEffort,
      );
    } catch (plannerError) {
      logWarn("api.generate-meme", "Meme planner output invalid, attempting repair", {
        requestId,
        tone,
        templateId: rawTemplateId || undefined,
        error: plannerError,
      });

      const repairResponse = await openai.responses.create({
        model,
        max_output_tokens: 300,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You repair malformed meme planner output into strict JSON.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildPlannerRepairPrompt({
                  templates: candidateTemplates,
                  rawOutput: response.output_text.trim(),
                }),
              },
            ],
          },
        ],
      });

      const repairedPlan = extractJsonObject(repairResponse.output_text.trim());
      result = buildMemeResult(
        templates,
        repairedPlan,
        requestId,
        rawTemplateId,
        model,
        reasoningEffort,
      );
    }

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
      requestId,
      tone,
      templateId: rawTemplateId || undefined,
      error,
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
