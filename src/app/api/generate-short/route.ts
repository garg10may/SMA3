import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { logError, logWarn } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import { createOpenAIClient } from "@/lib/openai-server";
import {
  DEFAULT_MODEL,
  DEFAULT_TONE,
  MAX_BRIEF_LENGTH,
  getTonePrompt,
  isToneOption,
} from "@/lib/post-config";
import {
  DEFAULT_SHORT_DURATION,
  DEFAULT_SHORT_MODEL,
  DEFAULT_SHORT_SIZE,
  DEFAULT_SHORT_TARGET,
  getShortEstimatedCostUsd,
  getShortTargetLabel,
  isShortDurationOption,
  isShortTargetOption,
  type ShortDurationOption,
  type ShortTargetOption,
} from "@/lib/short-config";

export const runtime = "nodejs";

type ShortPack = {
  title: string;
  hook: string;
  caption: string;
  hashtags: string[];
  videoPrompt: string;
  shotPlan: string[];
  audioDirection: string;
};

const SHORT_PLAN_FALLBACK_TITLE = "AI-generated short";

function normalizeLine(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeParagraph(value: string, maxLength: number) {
  return value
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxLength);
}

function normalizeHashtag(value: string) {
  const compact = value.trim().replace(/\s+/g, "");
  const prefixed = compact.startsWith("#") ? compact : `#${compact}`;
  return prefixed === "#" ? "" : prefixed;
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return trimmed.slice(start, end + 1);
}

function parseShortPack(raw: string, brief: string): ShortPack | null {
  const jsonText = extractJsonObject(raw);

  if (!jsonText) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const pack = parsed as Record<string, unknown>;
  const hashtags = Array.isArray(pack.hashtags)
    ? pack.hashtags
        .filter((value): value is string => typeof value === "string")
        .map(normalizeHashtag)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const shotPlan = Array.isArray(pack.shotPlan)
    ? pack.shotPlan
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeLine(value, 160))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const title =
    typeof pack.title === "string"
      ? normalizeLine(pack.title, 110)
      : SHORT_PLAN_FALLBACK_TITLE;
  const hook =
    typeof pack.hook === "string" ? normalizeLine(pack.hook, 140) : "";
  const caption =
    typeof pack.caption === "string"
      ? normalizeParagraph(pack.caption, 500)
      : "";
  const audioDirection =
    typeof pack.audioDirection === "string"
      ? normalizeLine(pack.audioDirection, 180)
      : "";
  const modelPrompt =
    typeof pack.videoPrompt === "string"
      ? normalizeParagraph(pack.videoPrompt, 1400)
      : "";

  const videoPrompt =
    modelPrompt ||
    [
      "Create a polished vertical social video for a public social-media audience.",
      `Core idea: ${normalizeLine(brief, 300)}.`,
      hook ? `Opening hook: ${hook}.` : "",
      "Style: strong first second, clean framing, clear motion, readable visual story, no text overlays, no logos, no watermarks.",
    ]
      .filter(Boolean)
      .join(" ");

  if (!title || !caption || !videoPrompt || shotPlan.length === 0) {
    return null;
  }

  return {
    title,
    hook: hook || title,
    caption,
    hashtags,
    videoPrompt,
    shotPlan,
    audioDirection:
      audioDirection || "Fast, modern, tension-building instrumental bed.",
  };
}

function getShortPlanPrompt(input: {
  brief: string;
  tonePrompt: string;
  target: ShortTargetOption;
  duration: ShortDurationOption;
}) {
  const targetLabel = getShortTargetLabel(input.target);

  return `You are creating a production pack for one AI-generated vertical short.

Return valid JSON only with this exact shape:
{
  "title": "string",
  "hook": "string",
  "caption": "string",
  "hashtags": ["#tag1", "#tag2"],
  "videoPrompt": "string",
  "shotPlan": ["beat 1", "beat 2", "beat 3"],
  "audioDirection": "string"
}

Topic brief:
${input.brief}

Publish target:
${targetLabel}

Duration:
${input.duration} seconds

Tone:
${input.tonePrompt}

Requirements:
- Make this usable for a YouTube Short / Reel / TikTok style upload.
- The video prompt must be written for a text-to-video model and must describe visuals only.
- Keep the video portrait-native for social posts.
- No on-screen text, captions, logos, UI screenshots, watermarks, split screens, or copyrighted characters.
- Do not reference real public figures or private individuals.
- The shot plan should be compact and sequential.
- Caption should be ready to paste with a light CTA but no spammy language.
- Keep hashtags relevant and limited to 2-4.
- The opening hook should land in the first second.`;
}

function serializeVideoStatus(
  video: OpenAI.Videos.Video,
  requestedTarget: ShortTargetOption,
) {
  const seconds = isShortDurationOption(video.seconds)
    ? video.seconds
    : DEFAULT_SHORT_DURATION;

  return {
    format: "short" as const,
    jobId: video.id,
    status: video.status,
    progress: video.progress,
    createdAt: video.created_at,
    completedAt: video.completed_at,
    expiresAt: video.expires_at,
    seconds,
    size: video.size,
    model: video.model || DEFAULT_SHORT_MODEL,
    target: requestedTarget,
    targetLabel: getShortTargetLabel(requestedTarget),
    estimatedCostUsd: getShortEstimatedCostUsd(seconds),
    errorMessage: video.error?.message ?? null,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return finalizeJsonResponse(
      "api.generate-short",
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

  const rawBrief =
    typeof payload === "object" &&
    payload !== null &&
    "brief" in payload &&
    typeof payload.brief === "string"
      ? payload.brief.trim()
      : "";

  const rawTone =
    typeof payload === "object" &&
    payload !== null &&
    "tone" in payload &&
    typeof payload.tone === "string"
      ? payload.tone
      : DEFAULT_TONE;

  const rawTarget =
    typeof payload === "object" &&
    payload !== null &&
    "target" in payload &&
    typeof payload.target === "string"
      ? payload.target
      : DEFAULT_SHORT_TARGET;

  const rawDuration =
    typeof payload === "object" &&
    payload !== null &&
    "duration" in payload &&
    typeof payload.duration === "string"
      ? payload.duration
      : DEFAULT_SHORT_DURATION;

  if (rawBrief.length < 12 || rawBrief.length > MAX_BRIEF_LENGTH) {
    return finalizeJsonResponse(
      "api.generate-short",
      request,
      startedAt,
      {
        error: `Briefs must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;
  const target = isShortTargetOption(rawTarget)
    ? rawTarget
    : DEFAULT_SHORT_TARGET;
  const duration = isShortDurationOption(rawDuration)
    ? rawDuration
    : DEFAULT_SHORT_DURATION;

  try {
    const openai = createOpenAIClient();
    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

    const planResponse = await openai.responses.create({
      model,
      max_output_tokens: 900,
      ...(model.startsWith("gpt-5")
        ? { reasoning: { effort: "minimal" as const } }
        : {}),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You create compact production packs for high-performing short-form social videos.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: getShortPlanPrompt({
                brief: rawBrief,
                tonePrompt: getTonePrompt(tone),
                target,
                duration,
              }),
            },
          ],
        },
      ],
    });

    const plan = parseShortPack(planResponse.output_text, rawBrief);

    if (!plan) {
      logWarn("api.generate-short", "OpenAI short plan parsing failed", {
        requestId,
        model,
        target,
        duration,
        briefLength: rawBrief.length,
        outputPreview: planResponse.output_text.slice(0, 700),
      });

      return finalizeJsonResponse(
        "api.generate-short",
        request,
        startedAt,
        {
          error: "The model did not return a usable short-generation plan.",
          requestId,
        },
        { status: 502 },
        { requestId, model, target, duration, tone },
      );
    }

    const video = await openai.videos.create({
      model: DEFAULT_SHORT_MODEL,
      prompt: plan.videoPrompt,
      seconds: duration,
      size: DEFAULT_SHORT_SIZE,
    });

    return finalizeJsonResponse(
      "api.generate-short",
      request,
      startedAt,
      {
        ...serializeVideoStatus(video, target),
        requestId,
        pack: plan,
      },
      undefined,
      { requestId, model, target, duration, tone },
    );
  } catch (error) {
    logError("api.generate-short", "OpenAI short generation failed", {
      requestId,
      target,
      duration,
      tone,
      briefLength: rawBrief.length,
      error,
    });

    return finalizeJsonResponse(
      "api.generate-short",
      request,
      startedAt,
      {
        error: getErrorMessage(
          error,
          "OpenAI could not generate a short right now.",
        ),
        requestId,
      },
      { status: 500 },
      { requestId, target, duration, tone },
    );
  }
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim();
  const rawTarget = searchParams.get("target")?.trim() ?? DEFAULT_SHORT_TARGET;
  const target = isShortTargetOption(rawTarget)
    ? rawTarget
    : DEFAULT_SHORT_TARGET;

  if (!jobId) {
    return finalizeJsonResponse(
      "api.generate-short",
      request,
      startedAt,
      {
        error: "A short jobId query parameter is required.",
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  try {
    const openai = createOpenAIClient();
    const video = await openai.videos.retrieve(jobId);

    return finalizeJsonResponse(
      "api.generate-short",
      request,
      startedAt,
      {
        ...serializeVideoStatus(video, target),
        requestId,
      },
      undefined,
      { requestId, jobId, target },
    );
  } catch (error) {
    logError("api.generate-short", "OpenAI short status check failed", {
      requestId,
      jobId,
      target,
      error,
    });

    return finalizeJsonResponse(
      "api.generate-short",
      request,
      startedAt,
      {
        error: getErrorMessage(
          error,
          "The short status could not be retrieved right now.",
        ),
        requestId,
      },
      { status: 500 },
      { requestId, jobId, target },
    );
  }
}
