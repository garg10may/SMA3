import { randomUUID } from "node:crypto";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import { getFallbackMemeTemplateCatalog, getMemeTemplateCatalog } from "@/lib/meme-agent";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const forceFresh = new URL(request.url).searchParams.get("refresh") === "1";
  const fallbackTemplates = getFallbackMemeTemplateCatalog();
  const templates = await getMemeTemplateCatalog({ forceFresh });

  return finalizeJsonResponse(
    "api.meme-templates",
    request,
    startedAt,
    {
      templates,
      count: templates.length,
      usingFallback: templates === fallbackTemplates,
      requestId,
    },
    undefined,
    {
      requestId,
      count: templates.length,
      usingFallback: templates === fallbackTemplates,
    },
  );
}
