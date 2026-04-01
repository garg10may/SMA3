import { NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/openai-server";

export const runtime = "nodejs";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim();
  const shouldDownload = searchParams.get("download") === "1";

  if (!jobId) {
    return NextResponse.json(
      { error: "A short jobId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const openai = createOpenAIClient();
    const videoResponse = await openai.videos.downloadContent(jobId);

    if (!videoResponse.ok || !videoResponse.body) {
      return NextResponse.json(
        {
          error:
            "The short video is not ready to download yet. Wait for completion and try again.",
        },
        { status: 409 },
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

    return new Response(videoResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("OpenAI short download failed", error);

    const message = getErrorMessage(
      error,
      "The short video could not be downloaded right now.",
    );

    if (message.includes("not ready yet")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
