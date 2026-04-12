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

function stringifyDetail(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function buildDetailSuffix(metadata?: RequestLogMetadata, keys: string[] = []) {
  if (!metadata) {
    return "";
  }

  const parts = keys
    .map((key) => {
      const value = stringifyDetail(metadata[key]);
      return value ? `${key}=${value}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function logIncomingRequest(scope: string, request: Request) {
  const { method, pathname, search } = getRequestContext(request);
  const route = `${pathname}${search ?? ""}`;
  logInfo(scope, `${method} ${route}`);
}

export function logCompletedRequest(
  scope: string,
  request: Request,
  startedAt: number,
  status: number,
  metadata?: RequestLogMetadata,
) {
  const { method, pathname, search } = getRequestContext(request);
  const route = `${pathname}${search ?? ""}`;
  const durationMs = getDurationMs(startedAt);
  const summary = `${method} ${route} ${status} ${durationMs.toFixed(2)}ms`;
  const detailKeys = [
    "templateId",
    "reactionIds",
    "tone",
    "model",
    "reasoningEffort",
    "fallback",
  ];

  logInfo(scope, `${summary}${buildDetailSuffix(metadata, detailKeys)}`);
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
