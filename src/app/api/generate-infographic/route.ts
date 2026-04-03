import { randomUUID } from "node:crypto";
import {
  buildFallbackInfographicBlueprint,
  buildInfographicBlueprintPrompt,
  DEFAULT_INFOGRAPHIC_VISUAL_STYLE,
  isInfographicVisualStyleOption,
  type InfographicBlueprint,
} from "@/lib/infographic";
import {
  buildInfographicSvgDataUrl,
  buildInfographicSvgMarkup,
} from "@/lib/infographic-render";
import { logError, logWarn } from "@/lib/logger";
import { createOpenAIClient } from "@/lib/openai-server";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  MAX_BRIEF_LENGTH,
  isReasoningEffortOption,
  isTextModelOption,
} from "@/lib/post-config";
import { finalizeJsonResponse } from "@/lib/server-request-logging";

export const runtime = "nodejs";

type ParsedBlueprintPanel = {
  title?: unknown;
  detail?: unknown;
  accent?: unknown;
};

type RawBlueprint = {
  headline?: unknown;
  subhead?: unknown;
  layout?: unknown;
  narrative?: unknown;
  palette?: unknown;
  panels?: ParsedBlueprintPanel[];
  visualHooks?: unknown[];
};

const infographicBlueprintSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "subhead",
    "layout",
    "narrative",
    "palette",
    "panels",
    "visualHooks",
  ],
  properties: {
    headline: { type: "string" },
    subhead: { type: "string" },
    layout: { type: "string" },
    narrative: { type: "string" },
    palette: { type: "string" },
    panels: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "accent"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          accent: { type: "string" },
        },
      },
    },
    visualHooks: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: { type: "string" },
    },
  },
} as const;

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampCopy(value: string, maxWords: number, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  let nextValue = words.slice(0, maxWords).join(" ");
  let truncated = words.length > maxWords;

  if (nextValue.length > maxChars) {
    nextValue = nextValue.slice(0, maxChars).trim();
    nextValue = nextValue.replace(/\s+\S*$/, "").trim() || nextValue;
    truncated = true;
  }

  nextValue = nextValue.replace(/[.,;:!?-]+$/, "").trim();

  if (!nextValue) {
    return "";
  }

  return truncated ? `${nextValue}...` : nextValue;
}

function normalizeInfographicBlueprint(
  parsed: RawBlueprint | null,
  fallback: InfographicBlueprint,
) {
  const parsedPanels = Array.isArray(parsed?.panels) ? parsed.panels : [];
  const panels = fallback.panels.map((panel, index) => {
    const nextPanel = parsedPanels[index];

    return {
      title:
        clampCopy(sanitizeString(nextPanel?.title), 3, 26) ||
        fallback.panels[index].title,
      detail:
        clampCopy(sanitizeString(nextPanel?.detail), 14, 88) ||
        fallback.panels[index].detail,
      accent:
        clampCopy(sanitizeString(nextPanel?.accent), 4, 28) ||
        fallback.panels[index].accent,
    };
  });

  const visualHooks = [
    ...(Array.isArray(parsed?.visualHooks)
      ? parsed.visualHooks
          .map((hook) => clampCopy(sanitizeString(hook), 6, 40))
          .filter(Boolean)
      : []),
    ...fallback.visualHooks,
  ].slice(0, 6);

  const blueprint = {
    headline:
      clampCopy(sanitizeString(parsed?.headline), 5, 30) || fallback.headline,
    subhead:
      clampCopy(sanitizeString(parsed?.subhead), 12, 82) || fallback.subhead,
    layout:
      clampCopy(sanitizeString(parsed?.layout), 24, 138) || fallback.layout,
    narrative:
      clampCopy(sanitizeString(parsed?.narrative), 24, 138) ||
      fallback.narrative,
    palette:
      clampCopy(sanitizeString(parsed?.palette), 8, 48) || fallback.palette,
    panels,
    visualHooks,
  };

  return blueprint;
}

function parseInfographicBlueprint(raw: string): RawBlueprint | null {
  const candidates = [
    raw.trim(),
    raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    const jsonCandidate =
      firstBrace >= 0 && lastBrace > firstBrace
        ? candidate.slice(firstBrace, lastBrace + 1)
        : candidate;

    try {
      return JSON.parse(jsonCandidate) as RawBlueprint;
    } catch {
      continue;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return finalizeJsonResponse(
      "api.generate-infographic",
      request,
      startedAt,
      {
        error: "The request body must be valid JSON.",
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  const rawConcept =
    typeof payload === "object" &&
    payload !== null &&
    "concept" in payload &&
    typeof payload.concept === "string"
      ? payload.concept.trim()
      : "";

  const rawAudience =
    typeof payload === "object" &&
    payload !== null &&
    "audience" in payload &&
    typeof payload.audience === "string"
      ? payload.audience.trim()
      : "";

  const rawFocus =
    typeof payload === "object" &&
    payload !== null &&
    "focus" in payload &&
    typeof payload.focus === "string"
      ? payload.focus.trim()
      : "";

  const rawArtDirection =
    typeof payload === "object" &&
    payload !== null &&
    "artDirection" in payload &&
    typeof payload.artDirection === "string"
      ? payload.artDirection.trim()
      : "";

  const rawVisualStyle =
    typeof payload === "object" &&
    payload !== null &&
    "visualStyle" in payload &&
    typeof payload.visualStyle === "string"
      ? payload.visualStyle
      : DEFAULT_INFOGRAPHIC_VISUAL_STYLE;

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

  if (rawConcept.length < 12 || rawConcept.length > MAX_BRIEF_LENGTH) {
    return finalizeJsonResponse(
      "api.generate-infographic",
      request,
      startedAt,
      {
        error: `Concepts must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  const visualStyle = isInfographicVisualStyleOption(rawVisualStyle)
    ? rawVisualStyle
    : DEFAULT_INFOGRAPHIC_VISUAL_STYLE;
  const model = isTextModelOption(rawModel) ? rawModel : DEFAULT_MODEL;
  const reasoningEffort = isReasoningEffortOption(rawReasoningEffort)
    ? rawReasoningEffort
    : DEFAULT_REASONING_EFFORT;
  const fallbackBlueprint = buildFallbackInfographicBlueprint({
    concept: rawConcept,
    audience: rawAudience,
    focus: rawFocus,
    visualStyle,
  });

  try {
    const openai = createOpenAIClient();
    const planningResponse = await openai.responses.create({
      model,
      max_output_tokens: 900,
      reasoning: { effort: reasoningEffort },
      text: {
        format: {
          type: "json_schema",
          name: "infographic_blueprint",
          strict: true,
          schema: infographicBlueprintSchema,
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You design crisp editorial blueprints for explanatory infographics. Return strict JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildInfographicBlueprintPrompt({
                concept: rawConcept,
                audience: rawAudience,
                focus: rawFocus,
                visualStyle,
                artDirection: rawArtDirection,
              }),
            },
          ],
        },
      ],
    });

    let blueprint: InfographicBlueprint | null = null;
    let parsedBlueprint: RawBlueprint | null = null;

    try {
      parsedBlueprint = JSON.parse(planningResponse.output_text) as RawBlueprint;
    } catch {
      parsedBlueprint = null;
    }

    if (!parsedBlueprint) {
      parsedBlueprint = parseInfographicBlueprint(planningResponse.output_text);
    }

    if (!parsedBlueprint) {
      logWarn("api.generate-infographic", "Infographic blueprint parsing failed", {
        requestId,
        model,
        reasoningEffort,
        visualStyle,
        conceptLength: rawConcept.length,
        outputPreview: planningResponse.output_text.slice(0, 700),
      });
    }

    blueprint = normalizeInfographicBlueprint(parsedBlueprint, fallbackBlueprint);

    const svgMarkup = buildInfographicSvgMarkup({
      concept: rawConcept,
      focus: rawFocus,
      blueprint,
      visualStyle,
    });
    const svgDataUrl = buildInfographicSvgDataUrl(svgMarkup);

    return finalizeJsonResponse(
      "api.generate-infographic",
      request,
      startedAt,
      {
        format: "infographic",
        concept: rawConcept,
        audience: rawAudience,
        focus: rawFocus,
        blueprint,
        visualStyle,
        graphicAlt: rawConcept.trim()
          ? `Infographic explaining ${rawConcept.trim()}`
          : "Concept infographic",
        svgMarkup,
        svgDataUrl,
        model,
        reasoningEffort,
        requestId,
      },
      undefined,
      { requestId, model, reasoningEffort, visualStyle },
    );
  } catch (error) {
    logError("api.generate-infographic", "Infographic generation failed", {
      requestId,
      model,
      reasoningEffort,
      visualStyle,
      conceptLength: rawConcept.length,
      error,
    });

    return finalizeJsonResponse(
      "api.generate-infographic",
      request,
      startedAt,
      {
        error: "OpenAI could not generate an infographic right now.",
        requestId,
      },
      { status: 500 },
      { requestId, model, reasoningEffort, visualStyle },
    );
  }
}
