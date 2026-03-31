import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  DEFAULT_FORMAT,
  DEFAULT_MODEL,
  DEFAULT_PLATFORM,
  DEFAULT_TONE,
  DEFAULT_THREAD_POSTS,
  MAX_MEDIUM_WORDS,
  MAX_THREAD_POSTS,
  MAX_BRIEF_LENGTH,
  MAX_POST_LENGTH,
  VARIANT_COUNT,
  isFormatOption,
  getTonePrompt,
  isPlatformOption,
  isToneOption,
} from "@/lib/post-config";

export const runtime = "nodejs";

function normalizePost(post: string) {
  const flattened = post.trim().replace(/\s+/g, " ");

  return flattened.length <= MAX_POST_LENGTH
    ? flattened
    : `${flattened.slice(0, MAX_POST_LENGTH - 3).trimEnd()}...`;
}

function extractThread(text: string) {
  return text
    .split(/\n\s*---\s*\n/g)
    .map((part) => part.replace(/^\d+\.\s*/, "").trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, MAX_THREAD_POSTS)
    .map(normalizePost);
}

function extractVariants(text: string) {
  return text
    .split(/\n\s*===\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, VARIANT_COUNT);
}

function normalizeMediumStory(story: string) {
  return story.replace(/\r\n/g, "\n").trim();
}

function getSystemPrompt(platform: "x" | "medium", format: "post" | "thread") {
  if (platform === "medium") {
    return `You write Medium-ready articles that paste cleanly into the Medium editor. Return one complete article in Markdown.

Rules:
- Begin with a single H1 title line using Markdown syntax: # Title
- Use only these Markdown features: headings (#, ##, ###), paragraphs, bullet lists, numbered lists, blockquotes, bold, italics, inline code, fenced code blocks with a language when code is included, and markdown links.
- Do not use tables, HTML tags, horizontal rules, footnotes, or the separator line ===.
- Keep the article between 600 and ${MAX_MEDIUM_WORDS} words.
- Structure it so it is easy to read on Medium: strong opening, clear section headings, concrete examples, and a short closing section.
- If the brief suggests code, include at least one fenced code block with a language label. If not, do not force code.
- Return only the article. No commentary before or after it.`;
  }

  if (format === "thread") {
    return `You write concise X threads. Return exactly ${VARIANT_COUNT} distinct thread variants.

Use a line containing exactly === between variants.
Inside each variant, use a line containing exactly --- between posts.

Rules:
- Return exactly ${VARIANT_COUNT} thread variants.
- Return exactly ${DEFAULT_THREAD_POSTS} posts inside each variant.
- Keep each post under ${MAX_POST_LENGTH} characters.
- Each post should move the idea forward, not repeat the same line.
- Do not add intro text, outro text, labels, or markdown bullets.
- Do not number the posts.
- Make the variants meaningfully different in angle or phrasing.
- Use the separator line === between variants and nowhere else.
- Use the separator line --- between posts and nowhere else.
- Use at most one hashtag across the full thread, and only if it helps.
- Keep the message specific and high-signal, not generic motivation.`;
  }

  return `You write concise posts for X. Return exactly ${VARIANT_COUNT} distinct post variants.

Use a line containing exactly === between variants.

Rules:
- Stay under ${MAX_POST_LENGTH} characters.
- Use one or two short sentences.
- No quotation marks around the post.
- No markdown, bullets, labels, or commentary.
- Make the variants meaningfully different in angle or phrasing.
- Use the separator line === between variants and nowhere else.
- No more than one hashtag, and only if it materially helps.
- Keep the message specific and high-signal, not generic motivation.`;
}

function getUserPrompt(
  platform: "x" | "medium",
  brief: string,
  tonePrompt: string,
  extra: {
    audience: string;
    mediumGoal: string;
    includeCode: boolean;
  },
) {
  if (platform === "medium") {
    return `Story brief:
${brief}

Target reader:
${extra.audience || "General professional audience"}

Article goal:
${extra.mediumGoal || "Teach a practical lesson"}

Code handling:
${extra.includeCode ? "Include code examples if they genuinely help explain the piece." : "Do not include code blocks unless absolutely necessary."}

Tone:
${tonePrompt}`;
  }

  return `Brief:
${brief}

Tone:
${tonePrompt}`;
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

  const rawPlatform =
    typeof payload === "object" &&
    payload !== null &&
    "platform" in payload &&
    typeof payload.platform === "string"
      ? payload.platform
      : DEFAULT_PLATFORM;

  const rawFormat =
    typeof payload === "object" &&
    payload !== null &&
    "format" in payload &&
    typeof payload.format === "string"
      ? payload.format
      : DEFAULT_FORMAT;

  const rawAudience =
    typeof payload === "object" &&
    payload !== null &&
    "audience" in payload &&
    typeof payload.audience === "string"
      ? payload.audience.trim()
      : "";

  const rawMediumGoal =
    typeof payload === "object" &&
    payload !== null &&
    "mediumGoal" in payload &&
    typeof payload.mediumGoal === "string"
      ? payload.mediumGoal.trim()
      : "";

  const rawIncludeCode =
    typeof payload === "object" &&
    payload !== null &&
    "includeCode" in payload &&
    typeof payload.includeCode === "boolean"
      ? payload.includeCode
      : true;

  if (rawBrief.length < 12 || rawBrief.length > MAX_BRIEF_LENGTH) {
    return NextResponse.json(
      {
        error: `Briefs must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;
  const platform = isPlatformOption(rawPlatform) ? rawPlatform : DEFAULT_PLATFORM;
  const format = isFormatOption(rawFormat) ? rawFormat : DEFAULT_FORMAT;

  try {
    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

    const response = await openai.responses.create({
      model,
      max_output_tokens: platform === "medium" ? 1800 : 1200,
      ...(model.startsWith("gpt-5")
        ? { reasoning: { effort: "minimal" as const } }
        : {}),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: getSystemPrompt(platform, format),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: getUserPrompt(platform, rawBrief, getTonePrompt(tone), {
                audience: rawAudience,
                mediumGoal: rawMediumGoal,
                includeCode: rawIncludeCode,
              }),
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
            platform === "medium"
              ? "The model returned an empty Medium story."
              : format === "thread"
                ? "The model returned an empty thread."
                : "The model returned an empty post.",
        },
        { status: 502 },
      );
    }

    if (platform === "medium") {
      const markdown = normalizeMediumStory(output);

      return NextResponse.json({
        format: "medium",
        markdown,
        words: markdown.split(/\s+/).filter(Boolean).length,
      });
    }

    const variants = extractVariants(output);

    if (variants.length < VARIANT_COUNT) {
      return NextResponse.json(
        { error: `The model did not return ${VARIANT_COUNT} usable variants.` },
        { status: 502 },
      );
    }

    if (format === "thread") {
      const threadVariants = variants
        .map((variant) => extractThread(variant))
        .filter((posts) => posts.length >= 2)
        .slice(0, VARIANT_COUNT);

      if (threadVariants.length < VARIANT_COUNT) {
        return NextResponse.json(
          {
            error: `The model did not return ${VARIANT_COUNT} usable thread variants.`,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        format: "thread",
        variants: threadVariants.map((posts) => ({
          posts: posts.map((text) => ({
            text,
            characters: text.length,
          })),
        })),
      });
    }

    return NextResponse.json({
      format: "post",
      variants: variants.map((variant) => {
        const post = normalizePost(variant);

        return {
          post,
          characters: post.length,
        };
      }),
    });
  } catch (error) {
    console.error("OpenAI generation failed", error);

    return NextResponse.json(
      { error: "OpenAI could not generate a post right now." },
      { status: 500 },
    );
  }
}
