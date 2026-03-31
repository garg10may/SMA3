import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  DEFAULT_MODEL,
  DEFAULT_TONE,
  MAX_BRIEF_LENGTH,
  MAX_POST_LENGTH,
  getTonePrompt,
  isToneOption,
} from "@/lib/post-config";

export const runtime = "nodejs";

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

  if (rawBrief.length < 12 || rawBrief.length > MAX_BRIEF_LENGTH) {
    return NextResponse.json(
      {
        error: `Briefs must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      max_output_tokens: 160,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You write concise posts for X. Return exactly one post and nothing else.

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

    const post = response.output_text.trim().replace(/\s+/g, " ");

    if (!post) {
      return NextResponse.json(
        { error: "The model returned an empty post." },
        { status: 502 },
      );
    }

    const normalizedPost =
      post.length <= MAX_POST_LENGTH
        ? post
        : `${post.slice(0, MAX_POST_LENGTH - 3).trimEnd()}...`;

    return NextResponse.json({
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
