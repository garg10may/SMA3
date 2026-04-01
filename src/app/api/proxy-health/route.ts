import { randomUUID } from "node:crypto";
import { logError } from "@/lib/logger";
import {
  getOpenAIProxyFetchOptions,
  readOpenAIProxyUrl,
  shouldUseOpenAIProxy,
} from "@/lib/openai-server";
import { finalizeJsonResponse } from "@/lib/server-request-logging";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const proxyEnabled = shouldUseOpenAIProxy();

  if (!proxyEnabled) {
    return finalizeJsonResponse(
      "api.proxy-health",
      request,
      startedAt,
      {
        ok: false,
        proxyEnabled: false,
        error: "OPENAI_USE_PROXY is disabled.",
        requestId,
      },
      { status: 409 },
      { requestId },
    );
  }

  try {
    const proxyUrl = new URL(readOpenAIProxyUrl());
    const response = await fetch("https://ipv4.webshare.io/", {
      ...getOpenAIProxyFetchOptions(),
      cache: "no-store",
    });

    if (!response.ok) {
      return finalizeJsonResponse(
        "api.proxy-health",
        request,
        startedAt,
        {
          ok: false,
          proxyEnabled: true,
          proxyHost: proxyUrl.hostname,
          proxyPort: proxyUrl.port || "(default)",
          error: `Proxy health check failed with ${response.status}.`,
          requestId,
        },
        { status: 502 },
        { requestId, proxyHost: proxyUrl.hostname },
      );
    }

    const exitIp = (await response.text()).trim();

    return finalizeJsonResponse(
      "api.proxy-health",
      request,
      startedAt,
      {
        ok: true,
        proxyEnabled: true,
        proxyHost: proxyUrl.hostname,
        proxyPort: proxyUrl.port || "(default)",
        exitIp,
        requestId,
      },
      undefined,
      { requestId, proxyHost: proxyUrl.hostname },
    );
  } catch (error) {
    logError("api.proxy-health", "Proxy health check failed", {
      requestId,
      error,
    });

    return finalizeJsonResponse(
      "api.proxy-health",
      request,
      startedAt,
      {
        ok: false,
        proxyEnabled: true,
        error: error instanceof Error ? error.message : "Proxy health check failed.",
        requestId,
      },
      { status: 500 },
      { requestId },
    );
  }
}
