import { randomUUID } from "node:crypto";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import {
  getReactionCatalog,
  searchReactionCatalog,
} from "@/lib/reaction-catalog";

export const runtime = "nodejs";

function readLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(1, Math.min(parsed, 60));
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q")?.trim() || "";
  const limit = readLimit(requestUrl.searchParams.get("limit"));
  const total = getReactionCatalog().length;
  const { items, fallback } = searchReactionCatalog(query, {
    limit,
    fallbackToPopular: true,
  });

  return finalizeJsonResponse(
    "api.reaction-catalog",
    request,
    startedAt,
    {
      items,
      count: items.length,
      total,
      query,
      source: "local",
      fallback,
      requestId,
    },
    undefined,
    {
      requestId,
      count: items.length,
      fallback,
    },
  );
}
