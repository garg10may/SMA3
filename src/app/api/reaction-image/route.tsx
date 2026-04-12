/* eslint-disable @next/next/no-img-element */

import { randomUUID } from "node:crypto";
import { ImageResponse } from "next/og";
import { logError } from "@/lib/logger";
import {
  finalizeJsonResponse,
  finalizeResponse,
} from "@/lib/server-request-logging";
import {
  getReactionCatalogEntry,
  sanitizeReactionCaption,
} from "@/lib/reaction-catalog";

export const runtime = "nodejs";

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1350;

function getCaptionFontSize(caption: string) {
  if (caption.length > 88) {
    return 52;
  }

  if (caption.length > 64) {
    return 60;
  }

  if (caption.length > 42) {
    return 68;
  }

  return 78;
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const requestUrl = new URL(request.url);
  const reactionId = requestUrl.searchParams.get("reactionId")?.trim() || "";
  const rawCaption = requestUrl.searchParams.get("caption")?.trim() || "";
  const caption = sanitizeReactionCaption(rawCaption);

  if (!reactionId) {
    return finalizeJsonResponse(
      "api.reaction-image",
      request,
      startedAt,
      { error: "The reaction id is required.", requestId },
      { status: 400 },
      { requestId },
    );
  }

  if (!caption) {
    return finalizeJsonResponse(
      "api.reaction-image",
      request,
      startedAt,
      { error: "The reaction caption is required.", requestId },
      { status: 400 },
      { requestId },
    );
  }

  const reaction = getReactionCatalogEntry(reactionId);

  if (!reaction) {
    return finalizeJsonResponse(
      "api.reaction-image",
      request,
      startedAt,
      { error: "The selected reaction image is not available.", requestId },
      { status: 404 },
      { requestId },
    );
  }

  try {
    const imageResponse = await fetch(reaction.imageUrl, {
      cache: "no-store",
    });

    if (!imageResponse.ok) {
      throw new Error(`Reaction source image request failed with ${imageResponse.status}.`);
    }

    const sourceImageBuffer = await imageResponse.arrayBuffer();
    const sourceImageType =
      imageResponse.headers.get("content-type") || "image/jpeg";
    const sourceImage = `data:${sourceImageType};base64,${Buffer.from(
      sourceImageBuffer,
    ).toString("base64")}`;
    const fontSize = getCaptionFontSize(caption);

    const response = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f6f3ee",
            color: "#121212",
            padding: "30px",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              fontSize,
              lineHeight: 1.08,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              padding: "4px 18px 28px 18px",
              minHeight: "180px",
            }}
          >
            {caption}
          </div>

          <div
            style={{
              width: "100%",
              flex: 1,
              display: "flex",
              borderRadius: "32px",
              overflow: "hidden",
              backgroundColor: "#ffffff",
              boxShadow: "0 18px 50px rgba(18,18,18,0.10)",
            }}
          >
            <img
              src={sourceImage}
              alt={reaction.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        </div>
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
      },
    );

    response.headers.set("cache-control", "no-store");

    return finalizeResponse(
      "api.reaction-image",
      request,
      startedAt,
      response,
      { requestId, reactionIds: reactionId },
    );
  } catch (error) {
    logError("api.reaction-image", "Reaction image render failed", {
      requestId,
      reactionIds: reactionId,
      error: error instanceof Error ? error.message : String(error),
    });

    return finalizeJsonResponse(
      "api.reaction-image",
      request,
      startedAt,
      { error: "The reaction image could not be rendered right now.", requestId },
      { status: 500 },
      { requestId, reactionIds: reactionId },
    );
  }
}
