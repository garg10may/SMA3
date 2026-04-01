import { randomUUID } from "node:crypto";
import { logError } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import {
  DEFAULT_MEDIUM_IMAGE_STYLE,
  isMediumImageStyleOption,
} from "@/lib/medium-image";
import { generateMediumLeadImage } from "@/lib/medium-image-server";
import { createOpenAIClient } from "@/lib/openai-server";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  isImageQualityOption,
  isImageModelOption,
} from "@/lib/post-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return finalizeJsonResponse(
      "api.generate-medium-image",
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

  const rawAudience =
    typeof payload === "object" &&
    payload !== null &&
    "audience" in payload &&
    typeof payload.audience === "string"
      ? payload.audience.trim()
      : "";

  const rawMediumGoal =
    typeof payload === "object" &&
    payload !== null &&
    "mediumGoal" in payload &&
    typeof payload.mediumGoal === "string"
      ? payload.mediumGoal.trim()
      : "";

  const rawImageStyle =
    typeof payload === "object" &&
    payload !== null &&
    "imageStyle" in payload &&
    typeof payload.imageStyle === "string"
      ? payload.imageStyle
      : DEFAULT_MEDIUM_IMAGE_STYLE;

  const rawImagePrompt =
    typeof payload === "object" &&
    payload !== null &&
    "imagePrompt" in payload &&
    typeof payload.imagePrompt === "string"
      ? payload.imagePrompt.trim()
      : "";

  const rawTitle =
    typeof payload === "object" &&
    payload !== null &&
    "title" in payload &&
    typeof payload.title === "string"
      ? payload.title.trim()
      : "";

  const rawImageModel =
    typeof payload === "object" &&
    payload !== null &&
    "imageModel" in payload &&
    typeof payload.imageModel === "string"
      ? payload.imageModel
      : DEFAULT_IMAGE_MODEL;

  const rawImageQuality =
    typeof payload === "object" &&
    payload !== null &&
    "imageQuality" in payload &&
    typeof payload.imageQuality === "string"
      ? payload.imageQuality
      : DEFAULT_IMAGE_QUALITY;

  const rawExcerpt =
    typeof payload === "object" &&
    payload !== null &&
    "excerpt" in payload &&
    typeof payload.excerpt === "string"
      ? payload.excerpt.trim()
      : "";

  if (!rawImagePrompt && rawBrief.length < 12) {
    return finalizeJsonResponse(
      "api.generate-medium-image",
      request,
      startedAt,
      {
        error:
          "Provide either an image prompt or a story seed so the image can be regenerated.",
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  const imageStyle = isMediumImageStyleOption(rawImageStyle)
    ? rawImageStyle
    : DEFAULT_MEDIUM_IMAGE_STYLE;
  const imageModel = isImageModelOption(rawImageModel)
    ? rawImageModel
    : DEFAULT_IMAGE_MODEL;
  const imageQuality = isImageQualityOption(rawImageQuality)
    ? rawImageQuality
    : DEFAULT_IMAGE_QUALITY;

  try {
    const openai = createOpenAIClient();
    const image = await generateMediumLeadImage({
      openai,
      brief: rawBrief,
      audience: rawAudience,
      mediumGoal: rawMediumGoal,
      imageStyle,
      imageModel,
      imageQuality,
      imagePrompt: rawImagePrompt,
      title: rawTitle,
      excerpt: rawExcerpt,
    });

    return finalizeJsonResponse(
      "api.generate-medium-image",
      request,
      startedAt,
      {
        ...image,
        requestId,
      },
      undefined,
      { requestId, imageStyle, imageModel, imageQuality },
    );
  } catch (error) {
    logError("api.generate-medium-image", "OpenAI image regeneration failed", {
      requestId,
      briefLength: rawBrief.length,
      imageStyle,
      imageModel,
      imageQuality,
      error,
    });

    return finalizeJsonResponse(
      "api.generate-medium-image",
      request,
      startedAt,
      {
        error: "OpenAI could not generate a new lead image right now.",
        requestId,
      },
      { status: 500 },
      { requestId, imageStyle, imageModel, imageQuality },
    );
  }
}
