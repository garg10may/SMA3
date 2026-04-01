import { NextResponse } from "next/server";
import { logInfo } from "@/lib/logger";

type RequestLogMetadata = Record<string, unknown>;

function getRequestContext(request: Request) {
  const url = new URL(request.url);

  return {
    method: request.method,
    pathname: url.pathname,
    search: url.search || undefined,
  };
}

function getDurationMs(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

export function logIncomingRequest(
  scope: string,
  request: Request,
  metadata?: RequestLogMetadata,
) {
  logInfo(scope, "Incoming request", {
    ...getRequestContext(request),
    ...metadata,
  });
}

export function logCompletedRequest(
  scope: string,
  request: Request,
  startedAt: number,
  status: number,
  metadata?: RequestLogMetadata,
) {
  logInfo(scope, "Request completed", {
    ...getRequestContext(request),
    status,
    durationMs: getDurationMs(startedAt),
    ...metadata,
  });
}

export function finalizeJsonResponse(
  scope: string,
  request: Request,
  startedAt: number,
  body: unknown,
  init?: ResponseInit,
  metadata?: RequestLogMetadata,
) {
  const response = NextResponse.json(body, init);
  logCompletedRequest(scope, request, startedAt, response.status, metadata);
  return response;
}

export function finalizeResponse(
  scope: string,
  request: Request,
  startedAt: number,
  response: Response,
  metadata?: RequestLogMetadata,
) {
  logCompletedRequest(scope, request, startedAt, response.status, metadata);
  return response;
}
