import { randomUUID } from "node:crypto";
import {
  buildFallbackInfographicPlan,
  buildInfographicDefaultPlanStyle,
  buildInfographicPlanPrompt,
  DEFAULT_INFOGRAPHIC_VISUAL_STYLE,
  isInfographicVisualStyleOption,
  normalizeInfographicIcon,
  type InfographicPlan,
} from "@/lib/infographic";
import {
  buildInfographicSceneSource,
} from "@/lib/infographic-manim";
import { logError, logWarn } from "@/lib/logger";
import { renderManimScene } from "@/lib/manim-server";
import { createOpenAIClient } from "@/lib/openai-server";
import {
  DEFAULT_REASONING_EFFORT,
  MAX_BRIEF_LENGTH,
  isReasoningEffortOption,
  isTextModelOption,
} from "@/lib/post-config";
import { finalizeJsonResponse } from "@/lib/server-request-logging";

export const runtime = "nodejs";

const DEFAULT_INFOGRAPHIC_MODEL = "gpt-5.4";

type ParsedPlanBlock = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  role?: unknown;
  icon?: unknown;
  emphasis?: unknown;
};

type ParsedPlanConnection = {
  fromId?: unknown;
  toId?: unknown;
  label?: unknown;
  style?: unknown;
};

type ParsedPlanCallout = {
  title?: unknown;
  body?: unknown;
  anchorId?: unknown;
  placement?: unknown;
  icon?: unknown;
};

type RawPlan = {
  headline?: unknown;
  subhead?: unknown;
  visualStyle?: unknown;
  layoutSummary?: unknown;
  narrative?: unknown;
  palette?: unknown;
  footer?: unknown;
  blocks?: ParsedPlanBlock[];
  connections?: ParsedPlanConnection[];
  callouts?: ParsedPlanCallout[];
  visualHooks?: unknown[];
  animationBeats?: unknown[];
};

const infographicPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "subhead",
    "visualStyle",
    "layoutSummary",
    "narrative",
    "palette",
    "footer",
    "blocks",
    "connections",
    "callouts",
    "visualHooks",
    "animationBeats",
  ],
  properties: {
    headline: { type: "string" },
    subhead: { type: "string" },
    visualStyle: {
      type: "string",
      enum: [
        "architecture-board",
        "flow-map",
        "feedback-loop",
        "comparison-grid",
      ],
    },
    layoutSummary: { type: "string" },
    narrative: { type: "string" },
    palette: { type: "string" },
    footer: { type: "string" },
    blocks: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "body", "role", "icon", "emphasis"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          role: { type: "string" },
          icon: { type: "string" },
          emphasis: { type: "string" },
        },
      },
    },
    connections: {
      type: "array",
      minItems: 2,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fromId", "toId", "label", "style"],
        properties: {
          fromId: { type: "string" },
          toId: { type: "string" },
          label: { type: "string" },
          style: { type: "string", enum: ["solid", "dashed", "loop"] },
        },
      },
    },
    callouts: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "anchorId", "placement", "icon"],
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          anchorId: { type: "string" },
          placement: {
            type: "string",
            enum: ["left", "right", "top", "bottom"],
          },
          icon: { type: "string" },
        },
      },
    },
    visualHooks: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: { type: "string" },
    },
    animationBeats: {
      type: "array",
      minItems: 3,
      maxItems: 8,
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

function slugifyId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function ensureUniqueId(seed: string, fallback: string, used: Set<string>) {
  const base = slugifyId(seed) || slugifyId(fallback) || "block";
  let nextId = base;
  let counter = 2;

  while (used.has(nextId)) {
    nextId = `${base}-${counter}`;
    counter += 1;
  }

  used.add(nextId);

  return nextId;
}

function isConnectionStyle(value: string): value is "solid" | "dashed" | "loop" {
  return value === "solid" || value === "dashed" || value === "loop";
}

function isCalloutPlacement(
  value: string,
): value is "left" | "right" | "top" | "bottom" {
  return (
    value === "left" ||
    value === "right" ||
    value === "top" ||
    value === "bottom"
  );
}

function parseInfographicPlan(raw: string): RawPlan | null {
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
      return JSON.parse(jsonCandidate) as RawPlan;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeInfographicPlan(parsed: RawPlan | null, fallback: InfographicPlan) {
  const parsedVisualStyle = sanitizeString(parsed?.visualStyle);
  const usedIds = new Set<string>();
  const rawBlocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
  const blockCount =
    rawBlocks.length >= 3
      ? Math.min(rawBlocks.length, 8)
      : fallback.blocks.length;

  const blocks = Array.from({ length: blockCount }, (_, index) => {
    const nextBlock = rawBlocks[index];
    const fallbackBlock = fallback.blocks[index] ?? fallback.blocks.at(-1)!;
    const title =
      clampCopy(sanitizeString(nextBlock?.title), 4, 32) || fallbackBlock.title;

    return {
      id: ensureUniqueId(
        sanitizeString(nextBlock?.id) || title,
        fallbackBlock.id,
        usedIds,
      ),
      title,
      body:
        clampCopy(sanitizeString(nextBlock?.body), 20, 120) ||
        fallbackBlock.body,
      role:
        clampCopy(sanitizeString(nextBlock?.role), 4, 24) || fallbackBlock.role,
      icon: normalizeInfographicIcon(
        sanitizeString(nextBlock?.icon) || fallbackBlock.icon,
      ),
      emphasis:
        clampCopy(sanitizeString(nextBlock?.emphasis), 5, 28) ||
        fallbackBlock.emphasis,
    };
  });

  const aliasMap = new Map<string, string>();

  for (const block of blocks) {
    aliasMap.set(block.id, block.id);
    aliasMap.set(slugifyId(block.id), block.id);
    aliasMap.set(slugifyId(block.title), block.id);
    aliasMap.set(block.title.toLowerCase(), block.id);
  }

  const resolveBlockId = (value: unknown) => {
    const raw = sanitizeString(value);
    const lowered = raw.toLowerCase();
    const slug = slugifyId(raw);

    return aliasMap.get(raw) ?? aliasMap.get(lowered) ?? aliasMap.get(slug) ?? "";
  };

  const parsedConnections = Array.isArray(parsed?.connections)
    ? parsed.connections
    : [];
  const connections = parsedConnections
    .map((connection) => {
      const fromId = resolveBlockId(connection?.fromId);
      const toId = resolveBlockId(connection?.toId);
      const style = sanitizeString(connection?.style).toLowerCase();

      if (!fromId || !toId || fromId === toId || !isConnectionStyle(style)) {
        return null;
      }

      return {
        fromId,
        toId,
        label: clampCopy(sanitizeString(connection?.label), 8, 42),
        style,
      };
    })
    .filter((connection): connection is NonNullable<typeof connection> =>
      Boolean(connection),
    )
    .slice(0, 12);

  const fallbackConnections = fallback.connections
    .map((connection) => {
      const fromId = resolveBlockId(connection.fromId);
      const toId = resolveBlockId(connection.toId);

      if (!fromId || !toId || fromId === toId) {
        return null;
      }

      return {
        fromId,
        toId,
        label: connection.label,
        style: connection.style,
      };
    })
    .filter((connection): connection is NonNullable<typeof connection> =>
      Boolean(connection),
    );

  const normalizedConnections =
    connections.length >= 2 ? connections : fallbackConnections;

  const parsedCallouts = Array.isArray(parsed?.callouts) ? parsed.callouts : [];
  const callouts = parsedCallouts
    .map((callout, index) => {
      const anchorId = resolveBlockId(callout?.anchorId);
      const placement = sanitizeString(callout?.placement).toLowerCase();

      if (!anchorId || !isCalloutPlacement(placement)) {
        return null;
      }

      const fallbackCallout = fallback.callouts[index] ?? fallback.callouts[0];

      return {
        title:
          clampCopy(sanitizeString(callout?.title), 5, 30) ||
          fallbackCallout?.title ||
          "Callout",
        body:
          clampCopy(sanitizeString(callout?.body), 16, 108) ||
          fallbackCallout?.body ||
          "Important note.",
        anchorId,
        placement,
        icon: normalizeInfographicIcon(
          sanitizeString(callout?.icon) || fallbackCallout?.icon || "spark",
        ),
      };
    })
    .filter((callout): callout is NonNullable<typeof callout> => Boolean(callout))
    .slice(0, 3);

  const visualHooks = [
    ...(Array.isArray(parsed?.visualHooks)
      ? parsed.visualHooks
          .map((hook) => clampCopy(sanitizeString(hook), 10, 68))
          .filter(Boolean)
      : []),
    ...fallback.visualHooks,
  ].slice(0, 8);

  const animationBeats = [
    ...(Array.isArray(parsed?.animationBeats)
      ? parsed.animationBeats
          .map((beat) => clampCopy(sanitizeString(beat), 12, 84))
          .filter(Boolean)
      : []),
    ...fallback.animationBeats,
  ].slice(0, 8);

  return {
    headline:
      clampCopy(sanitizeString(parsed?.headline), 7, 38) || fallback.headline,
    subhead:
      clampCopy(sanitizeString(parsed?.subhead), 14, 96) || fallback.subhead,
    visualStyle: isInfographicVisualStyleOption(parsedVisualStyle)
      ? parsedVisualStyle
      : fallback.visualStyle,
    layoutSummary:
      clampCopy(sanitizeString(parsed?.layoutSummary), 22, 160) ||
      fallback.layoutSummary,
    narrative:
      clampCopy(sanitizeString(parsed?.narrative), 22, 160) || fallback.narrative,
    palette:
      clampCopy(sanitizeString(parsed?.palette), 12, 84) || fallback.palette,
    footer:
      clampCopy(sanitizeString(parsed?.footer), 18, 120) || fallback.footer,
    blocks,
    connections: normalizedConnections,
    callouts: callouts.length > 0 ? callouts : fallback.callouts,
    visualHooks,
    animationBeats,
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
      : DEFAULT_INFOGRAPHIC_MODEL;

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

  const requestedVisualStyle = isInfographicVisualStyleOption(rawVisualStyle)
    ? rawVisualStyle
    : DEFAULT_INFOGRAPHIC_VISUAL_STYLE;
  const visualStyle = buildInfographicDefaultPlanStyle(
    rawConcept,
    requestedVisualStyle,
  );
  const model = isTextModelOption(rawModel) ? rawModel : DEFAULT_INFOGRAPHIC_MODEL;
  const reasoningEffort = isReasoningEffortOption(rawReasoningEffort)
    ? rawReasoningEffort
    : DEFAULT_REASONING_EFFORT;
  const fallbackPlan = buildFallbackInfographicPlan({
    concept: rawConcept,
    audience: rawAudience,
    focus: rawFocus,
    visualStyle,
  });

  try {
    const openai = createOpenAIClient();
    const planningInput = [
      {
        role: "system" as const,
        content: [
          {
            type: "input_text" as const,
            text: "You expand technical concepts into clean editorial scene plans for single-image explainers. Return strict JSON only.",
          },
        ],
      },
      {
        role: "user" as const,
        content: [
          {
            type: "input_text" as const,
            text: buildInfographicPlanPrompt({
              concept: rawConcept,
              audience: rawAudience,
              focus: rawFocus,
              visualStyle,
              artDirection: rawArtDirection,
            }),
          },
        ],
      },
    ];
    let planningResponse = await openai.responses.create({
      model,
      max_output_tokens: 1600,
      reasoning: { effort: reasoningEffort },
      text: {
        format: {
          type: "json_schema",
          name: "infographic_scene_plan",
          strict: true,
          schema: infographicPlanSchema,
        },
      },
      input: planningInput,
    });

    if (
      planningResponse.status === "incomplete" &&
      planningResponse.incomplete_details?.reason === "max_output_tokens"
    ) {
      logWarn(
        "api.generate-infographic",
        "Infographic plan hit token limit, retrying with larger budget",
        {
          requestId,
          model,
          reasoningEffort,
          visualStyle,
        },
      );

      planningResponse = await openai.responses.create({
        model,
        max_output_tokens: 3200,
        reasoning: { effort: reasoningEffort === "none" ? "none" : "low" },
        text: {
          format: {
            type: "json_schema",
            name: "infographic_scene_plan_retry",
            strict: true,
            schema: infographicPlanSchema,
          },
        },
        input: planningInput,
      });
    }

    let parsedPlan: RawPlan | null = null;

    try {
      parsedPlan = JSON.parse(planningResponse.output_text) as RawPlan;
    } catch {
      parsedPlan = parseInfographicPlan(planningResponse.output_text);
    }

    if (!parsedPlan) {
      logWarn("api.generate-infographic", "Infographic plan parsing failed", {
        requestId,
        model,
        reasoningEffort,
        visualStyle,
        outputPreview: planningResponse.output_text.slice(0, 900),
      });
    }

    const plan = normalizeInfographicPlan(parsedPlan, fallbackPlan);
    const pythonSource = buildInfographicSceneSource({ plan });
    const sceneClassName = "InfographicScene";
    const renderSource = "template";
    const renderNotes = [
      "Rendered from the local Manim layout template for cleaner structure and spacing.",
      ...plan.visualHooks.slice(0, 3),
    ].slice(0, 4);

    const renderResult = await renderManimScene({
      pythonSource,
      sceneClassName,
      requestId,
    });

    return finalizeJsonResponse(
      "api.generate-infographic",
      request,
      startedAt,
      {
        format: "infographic",
        concept: rawConcept,
        audience: rawAudience,
        focus: rawFocus,
        plan,
        visualStyle: plan.visualStyle,
        graphicAlt: rawConcept.trim()
          ? `${plan.headline}: infographic explaining ${rawConcept.trim()}`
          : "Concept infographic",
        pngDataUrl: renderResult.pngDataUrl,
        pythonSource,
        sceneClassName,
        renderNotes,
        renderSource,
        model,
        reasoningEffort,
        requestId,
      },
      undefined,
      { requestId, model, reasoningEffort, visualStyle: plan.visualStyle },
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
        error: "The infographic could not be rendered right now.",
        requestId,
      },
      { status: 500 },
      { requestId, model, reasoningEffort, visualStyle },
    );
  }
}
