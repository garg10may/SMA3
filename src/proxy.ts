import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logIncomingRequest } from "@/lib/server-request-logging";

export function proxy(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-request-id", requestId);

  logIncomingRequest("proxy", request, {
    requestId,
    referer: request.headers.get("referer") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
