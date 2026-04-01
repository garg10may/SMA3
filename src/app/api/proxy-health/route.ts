import { NextResponse } from "next/server";
import {
  getOpenAIProxyFetchOptions,
  readOpenAIProxyUrl,
  shouldUseOpenAIProxy,
} from "@/lib/openai-server";

export const runtime = "nodejs";

export async function GET() {
  const proxyEnabled = shouldUseOpenAIProxy();

  if (!proxyEnabled) {
    return NextResponse.json(
      {
        ok: false,
        proxyEnabled: false,
        error: "OPENAI_USE_PROXY is disabled.",
      },
      { status: 409 },
    );
  }

  try {
    const proxyUrl = new URL(readOpenAIProxyUrl());
    const response = await fetch("https://ipv4.webshare.io/", {
      ...getOpenAIProxyFetchOptions(),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          proxyEnabled: true,
          proxyHost: proxyUrl.hostname,
          proxyPort: proxyUrl.port || "(default)",
          error: `Proxy health check failed with ${response.status}.`,
        },
        { status: 502 },
      );
    }

    const exitIp = (await response.text()).trim();

    return NextResponse.json({
      ok: true,
      proxyEnabled: true,
      proxyHost: proxyUrl.hostname,
      proxyPort: proxyUrl.port || "(default)",
      exitIp,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        proxyEnabled: true,
        error: error instanceof Error ? error.message : "Proxy health check failed.",
      },
      { status: 500 },
    );
  }
}
