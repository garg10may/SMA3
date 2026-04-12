import { randomUUID } from "node:crypto";
import {
  DEFAULT_MEMEGEN_API_BASE_URL,
  readMemegenApiKey,
} from "@/lib/meme-agent";
import {
  finalizeJsonResponse,
  finalizeResponse,
} from "@/lib/server-request-logging";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const requestUrl = new URL(request.url);
  const template = requestUrl.searchParams.get("template")?.trim() || "";
  const lines = requestUrl.searchParams.getAll("lines[]");
  const width = requestUrl.searchParams.get("width")?.trim() || "";
  const font = requestUrl.searchParams.get("font")?.trim() || "";

  if (!template) {
    return finalizeJsonResponse(
      "api.meme-image",
      request,
      startedAt,
      { error: "The meme template is required.", requestId },
      { status: 400 },
    );
  }

  const encodedLines = lines.length > 0 ? lines : ["_"];
  const upstreamUrl = new URL(
    `${DEFAULT_MEMEGEN_API_BASE_URL}/images/${template}/${encodedLines.join("/")}.jpg`,
  );

  if (width) {
    upstreamUrl.searchParams.set("width", width);
  }

  if (font) {
    upstreamUrl.searchParams.set("font", font);
  }

  const headers = new Headers({
    Accept: "image/jpeg,image/*;q=0.8,*/*;q=0.5",
  });
  const apiKey = readMemegenApiKey();

  if (apiKey) {
    headers.set("X-API-KEY", apiKey);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers,
    cache: "no-store",
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return finalizeJsonResponse(
      "api.meme-image",
      request,
      startedAt,
      {
        error: "The meme image could not be rendered right now.",
        requestId,
      },
      { status: upstreamResponse.status || 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType =
    upstreamResponse.headers.get("content-type") || "image/jpeg";
  responseHeaders.set("content-type", contentType);
  responseHeaders.set("cache-control", "no-store");

  return finalizeResponse(
    "api.meme-image",
    request,
    startedAt,
    new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    }),
  );
}
