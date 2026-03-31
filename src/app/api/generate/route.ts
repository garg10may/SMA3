import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  DEFAULT_FORMAT,
  DEFAULT_MODEL,
  DEFAULT_TONE,
  DEFAULT_THREAD_POSTS,
  MAX_THREAD_POSTS,
  MAX_BRIEF_LENGTH,
  MAX_POST_LENGTH,
  isFormatOption,
  getTonePrompt,
  isToneOption,
} from "@/lib/post-config";

export const runtime = "nodejs";

function normalizePost(post: string) {
  return post.length <= MAX_POST_LENGTH
    ? post
    : `${post.slice(0, MAX_POST_LENGTH - 3).trimEnd()}...`;
}

function extractThread(text: string) {
  return text
    .split(/\n\s*---\s*\n/g)
    .map((part) => part.replace(/^\d+\.\s*/, "").trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, MAX_THREAD_POSTS)
    .map(normalizePost);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing on the server." },
      { status: 500 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const rawBrief =
    typeof payload === "object" &&
    payload !== null &&
    "brief" in payload &&
    typeof payload.brief === "string"
      ? payload.brief.trim()
      : "";

  const rawTone =
    typeof payload === "object" &&
    payload !== null &&
    "tone" in payload &&
    typeof payload.tone === "string"
      ? payload.tone
      : DEFAULT_TONE;

  const rawFormat =
    typeof payload === "object" &&
    payload !== null &&
    "format" in payload &&
    typeof payload.format === "string"
      ? payload.format
      : DEFAULT_FORMAT;

  if (rawBrief.length < 12 || rawBrief.length > MAX_BRIEF_LENGTH) {
    return NextResponse.json(
      {
        error: `Briefs must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;
  const format = isFormatOption(rawFormat) ? rawFormat : DEFAULT_FORMAT;

  try {
    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

    const response = await openai.responses.create({
      model,
      max_output_tokens: 400,
      ...(model.startsWith("gpt-5")
        ? { reasoning: { effort: "minimal" as const } }
        : {}),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                format === "thread"
                  ? `You write concise X threads. Return exactly ${DEFAULT_THREAD_POSTS} posts separated only by a line containing three dashes: ---

Rules:
- Return exactly ${DEFAULT_THREAD_POSTS} posts.
- Keep each post under ${MAX_POST_LENGTH} characters.
- Each post should move the idea forward, not repeat the same line.
- Do not add intro text, outro text, labels, or markdown bullets.
- Do not number the posts.
- Use the separator line --- between posts and nowhere else.
- Use at most one hashtag across the full thread, and only if it helps.
- Keep the message specific and high-signal, not generic motivation.`
                  : `You write concise posts for X. Return exactly one post and nothing else.

Rules:
- Stay under ${MAX_POST_LENGTH} characters.
- Use one or two short sentences.
- No quotation marks around the post.
- No markdown, bullets, labels, or commentary.
- No more than one hashtag, and only if it materially helps.
- Keep the message specific and high-signal, not generic motivation.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Brief:
${rawBrief}

Tone:
${getTonePrompt(tone)}`,
            },
          ],
        },
      ],
    });

    const output = response.output_text.trim();

    if (!output) {
      return NextResponse.json(
        {
          error:
            format === "thread"
              ? "The model returned an empty thread."
              : "The model returned an empty post.",
        },
        { status: 502 },
      );
    }

    if (format === "thread") {
      const posts = extractThread(output);

      if (posts.length < 2) {
        return NextResponse.json(
          { error: "The model did not return a usable thread." },
          { status: 502 },
        );
      }

      return NextResponse.json({
        format: "thread",
        posts: posts.map((text) => ({
          text,
          characters: text.length,
        })),
      });
    }

    const normalizedPost = normalizePost(output.replace(/\s+/g, " "));

    return NextResponse.json({
      format: "post",
      post: normalizedPost,
      characters: normalizedPost.length,
    });
  } catch (error) {
    console.error("OpenAI generation failed", error);

    return NextResponse.json(
      { error: "OpenAI could not generate a post right now." },
      { status: 500 },
    );
  }
}
