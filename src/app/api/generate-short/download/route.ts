import { randomUUID } from "node:crypto";
import { logError } from "@/lib/logger";
import {
  finalizeJsonResponse,
  finalizeResponse,
} from "@/lib/server-request-logging";
import { createOpenAIClient } from "@/lib/openai-server";

export const runtime = "nodejs";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim();
  const shouldDownload = searchParams.get("download") === "1";

  if (!jobId) {
    return finalizeJsonResponse(
      "api.generate-short.download",
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
    const videoResponse = await openai.videos.downloadContent(jobId);

    if (!videoResponse.ok || !videoResponse.body) {
      return finalizeJsonResponse(
        "api.generate-short.download",
        request,
        startedAt,
        {
          error:
            "The short video is not ready to download yet. Wait for completion and try again.",
          requestId,
        },
        { status: 409 },
        { requestId, jobId, shouldDownload },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      videoResponse.headers.get("content-type") ?? "video/mp4",
    );
    headers.set("Cache-Control", "no-store");

    if (shouldDownload) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${jobId}-short.mp4"`,
      );
    }

    return finalizeResponse(
      "api.generate-short.download",
      request,
      startedAt,
      new Response(videoResponse.body, {
        status: 200,
        headers,
      }),
      { requestId, jobId, shouldDownload },
    );
  } catch (error) {
    logError("api.generate-short.download", "OpenAI short download failed", {
      requestId,
      jobId,
      shouldDownload,
      error,
    });

    const message = getErrorMessage(
      error,
      "The short video could not be downloaded right now.",
    );

    if (message.includes("not ready yet")) {
      return finalizeJsonResponse(
        "api.generate-short.download",
        request,
        startedAt,
        { error: message, requestId },
        { status: 409 },
        { requestId, jobId, shouldDownload },
      );
    }

    return finalizeJsonResponse(
      "api.generate-short.download",
      request,
      startedAt,
      { error: message, requestId },
      { status: 500 },
      { requestId, jobId, shouldDownload },
    );
  }
}
