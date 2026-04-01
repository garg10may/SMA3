import { randomUUID } from "node:crypto";
import { logError } from "@/lib/logger";
import { finalizeJsonResponse } from "@/lib/server-request-logging";
import {
  buildMediumLeadImagePrompt,
  DEFAULT_MEDIUM_IMAGE_STYLE,
  isMediumImageStyleOption,
} from "@/lib/medium-image";
import { generateMediumLeadImage } from "@/lib/medium-image-server";
import { createOpenAIClient } from "@/lib/openai-server";
import {
  DEFAULT_FORMAT,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_MODEL,
  DEFAULT_PLATFORM,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TONE,
  DEFAULT_THREAD_POSTS,
  MAX_MEDIUM_WORDS,
  MAX_THREAD_POSTS,
  MAX_BRIEF_LENGTH,
  MAX_POST_LENGTH,
  VARIANT_COUNT,
  isImageQualityOption,
  isImageModelOption,
  isFormatOption,
  getTonePrompt,
  isReasoningEffortOption,
  isPlatformOption,
  isTextModelOption,
  isToneOption,
} from "@/lib/post-config";

export const runtime = "nodejs";
const OUTPUT_PREVIEW_LENGTH = 700;

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

function summarizeText(text: string, maxLength = OUTPUT_PREVIEW_LENGTH) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function summarizeOpenAIResponse(response: {
  id?: string;
  error?: unknown;
  incomplete_details?: unknown;
  model?: string;
  output_text?: string;
  status?: string;
  usage?: unknown;
}) {
  return {
    id: response.id,
    model: response.model,
    status: response.status,
    incompleteDetails: response.incomplete_details,
    usage: response.usage,
    error: response.error,
    outputPreview: summarizeText(response.output_text ?? ""),
  };
}

type MediumMathEmbed = {
  token: string;
  latex: string;
  url: string;
  embedUrl: string;
  width: number;
  height: number;
};

function extractMathBlocks(markdown: string) {
  const mathBlocks: { token: string; latex: string }[] = [];
  let index = 0;

  let nextMarkdown = markdown.replace(
    /```math\s*\n([\s\S]*?)\n```/g,
    (_, latex: string) => {
      const token = `@@MATH_EMBED_${index}@@`;
      index += 1;
      mathBlocks.push({ token, latex: latex.trim() });
      return token;
    },
  );

  nextMarkdown = nextMarkdown.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex: string) => {
    const token = `@@MATH_EMBED_${index}@@`;
    index += 1;
    mathBlocks.push({ token, latex: latex.trim() });
    return token;
  });

  return {
    markdown: nextMarkdown,
    mathBlocks,
  };
}

function estimateMathEmbedSize(latex: string) {
  const lines = latex.split("\n");
  const longestLine = Math.max(...lines.map((line) => line.length), 12);

  return {
    width: Math.min(900, Math.max(320, longestLine * 11)),
    height: Math.min(360, Math.max(140, lines.length * 42 + 80)),
  };
}

async function createMathEmbed(latex: string): Promise<Omit<MediumMathEmbed, "token" | "latex">> {
  const createResponse = await fetch("https://math.embed.fun/api/v1/formulas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!createResponse.ok) {
    throw new Error(`Create math formula failed with ${createResponse.status}`);
  }

  const formula = (await createResponse.json()) as {
    object_id: number;
    object_uuid: string;
    object_type: string;
    published: boolean;
    data: { latex: string };
    width: number;
    height: number;
  };

  const { width, height } = estimateMathEmbedSize(latex);

  const updatedFormula = {
    ...formula,
    data: {
      ...formula.data,
      latex,
    },
    width,
    height,
  };

  const updateResponse = await fetch(
    `https://math.embed.fun/api/v1/formulas/${formula.object_uuid}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedFormula),
    },
  );

  if (!updateResponse.ok) {
    throw new Error(`Update math formula failed with ${updateResponse.status}`);
  }

  const publishResponse = await fetch(
    `https://math.embed.fun/api/v1/formulas/${formula.object_uuid}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedFormula),
    },
  );

  if (!publishResponse.ok) {
    throw new Error(`Publish math formula failed with ${publishResponse.status}`);
  }

  return {
    url: `https://math.embed.fun/${formula.object_uuid}`,
    embedUrl: `https://math.embed.fun/embed/${formula.object_uuid}`,
    width,
    height,
  };
}

function extractMediumTitle(markdown: string) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "Feature article";
}

function extractMediumExcerpt(markdown: string) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#") && !line.startsWith("```"));

  return lines.slice(0, 2).join(" ").slice(0, 320);
}

function getSystemPrompt(platform: "x" | "medium", format: "post" | "thread") {
  if (platform === "medium") {
    return `You write Medium-ready articles that paste cleanly into the Medium editor. Return one complete article in Markdown.

Rules:
- Begin with a single H1 title line using Markdown syntax: # Title
- Use only these Markdown features: headings (#, ##, ###), paragraphs, bullet lists, numbered lists, blockquotes, bold, italics, inline code, fenced code blocks with a language when code is included, fenced math blocks using three backticks followed by math, and markdown links.
- Do not use tables, HTML tags, horizontal rules, footnotes, or the separator line ===.
- Keep the article between 600 and ${MAX_MEDIUM_WORDS} words.
- Structure it so it is easy to read on Medium: strong opening, clear section headings, concrete examples, and a short closing section.
- If the brief suggests code, include at least one fenced code block with a language label. If not, do not force code.
- If the brief needs mathematical notation, put display equations in fenced math blocks using three backticks followed by math, and avoid inline LaTeX delimiters in prose.
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
  const startedAt = performance.now();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return finalizeJsonResponse(
      "api.generate",
      request,
      startedAt,
      { error: "The request body must be valid JSON.", requestId },
      { status: 400 },
      { requestId },
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

  const rawImageStyle =
    typeof payload === "object" &&
    payload !== null &&
    "imageStyle" in payload &&
    typeof payload.imageStyle === "string"
      ? payload.imageStyle
      : DEFAULT_MEDIUM_IMAGE_STYLE;

  const rawImagePrompt =
    typeof payload === "object" &&
    payload !== null &&
    "imagePrompt" in payload &&
    typeof payload.imagePrompt === "string"
      ? payload.imagePrompt.trim()
      : "";

  const rawReasoningEffort =
    typeof payload === "object" &&
    payload !== null &&
    "reasoningEffort" in payload &&
    typeof payload.reasoningEffort === "string"
      ? payload.reasoningEffort
      : DEFAULT_REASONING_EFFORT;

  const rawModel =
    typeof payload === "object" &&
    payload !== null &&
    "model" in payload &&
    typeof payload.model === "string"
      ? payload.model
      : process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  const rawImageModel =
    typeof payload === "object" &&
    payload !== null &&
    "imageModel" in payload &&
    typeof payload.imageModel === "string"
      ? payload.imageModel
      : DEFAULT_IMAGE_MODEL;

  const rawImageQuality =
    typeof payload === "object" &&
    payload !== null &&
    "imageQuality" in payload &&
    typeof payload.imageQuality === "string"
      ? payload.imageQuality
      : DEFAULT_IMAGE_QUALITY;

  if (rawBrief.length < 12 || rawBrief.length > MAX_BRIEF_LENGTH) {
    return finalizeJsonResponse(
      "api.generate",
      request,
      startedAt,
      {
        error: `Briefs must be between 12 and ${MAX_BRIEF_LENGTH} characters.`,
        requestId,
      },
      { status: 400 },
      { requestId },
    );
  }

  const tone = isToneOption(rawTone) ? rawTone : DEFAULT_TONE;
  const platform = isPlatformOption(rawPlatform) ? rawPlatform : DEFAULT_PLATFORM;
  const format = isFormatOption(rawFormat) ? rawFormat : DEFAULT_FORMAT;
  const imageStyle = isMediumImageStyleOption(rawImageStyle)
    ? rawImageStyle
    : DEFAULT_MEDIUM_IMAGE_STYLE;
  const model = isTextModelOption(rawModel) ? rawModel : DEFAULT_MODEL;
  const reasoningEffort = isReasoningEffortOption(rawReasoningEffort)
    ? rawReasoningEffort
    : DEFAULT_REASONING_EFFORT;
  const imageModel = isImageModelOption(rawImageModel)
    ? rawImageModel
    : DEFAULT_IMAGE_MODEL;
  const imageQuality = isImageQualityOption(rawImageQuality)
    ? rawImageQuality
    : DEFAULT_IMAGE_QUALITY;
  const requestContext = {
    requestId,
    platform,
    format,
    tone,
    model,
    reasoningEffort,
    briefLength: rawBrief.length,
  };

  try {
    const openai = createOpenAIClient();

    const response = await openai.responses.create({
      model,
      max_output_tokens: platform === "medium" ? 1800 : 1200,
      reasoning: { effort: reasoningEffort },
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
    const responseSummary = summarizeOpenAIResponse(response);

    if (!output) {
      logError("api.generate", "OpenAI generation returned empty output", {
        ...requestContext,
        response: responseSummary,
      });

      return finalizeJsonResponse(
        "api.generate",
        request,
        startedAt,
        {
          error:
            platform === "medium"
              ? "The model returned an empty Medium story."
              : format === "thread"
                ? "The model returned an empty thread."
                : "The model returned an empty post.",
          requestId,
        },
        { status: 502 },
        requestContext,
      );
    }

    if (platform === "medium") {
      const markdown = normalizeMediumStory(output);
      const extractedMath = extractMathBlocks(markdown);
      const title = extractMediumTitle(markdown);
      const excerpt = extractMediumExcerpt(markdown);
      let leadImageDataUrl: string | null = null;
      let leadImageAlt = title ? `Lead image for ${title}` : "Lead image for the article";
      let imagePrompt = buildMediumLeadImagePrompt({
        brief: rawBrief,
        audience: rawAudience,
        mediumGoal: rawMediumGoal,
        imageStyle,
        customPrompt: rawImagePrompt,
        title,
        excerpt,
      });
      let mathEmbeds: MediumMathEmbed[] = [];

      if (extractedMath.mathBlocks.length > 0) {
        mathEmbeds = await Promise.all(
          extractedMath.mathBlocks.map(async (mathBlock) => {
            const embed = await createMathEmbed(mathBlock.latex);

            return {
              token: mathBlock.token,
              latex: mathBlock.latex,
              ...embed,
            };
          }),
        );
      }

      try {
        const image = await generateMediumLeadImage({
          openai,
          brief: rawBrief,
          audience: rawAudience,
          mediumGoal: rawMediumGoal,
          imageStyle,
          imageModel,
          imageQuality,
          imagePrompt: rawImagePrompt,
          title,
          excerpt,
        });
        leadImageAlt = image.leadImageAlt;
        leadImageDataUrl = image.leadImageDataUrl;
        imagePrompt = image.imagePrompt;
      } catch (imageError) {
        logError("api.generate", "OpenAI image generation failed", {
          ...requestContext,
          platform,
          imageStyle,
          imageModel,
          imageQuality,
          error: imageError,
        });
      }

      return finalizeJsonResponse(
        "api.generate",
        request,
        startedAt,
        {
          format: "medium",
          title,
          excerpt,
          markdown: extractedMath.markdown,
          words: extractedMath.markdown.split(/\s+/).filter(Boolean).length,
          leadImageAlt,
          leadImageDataUrl,
          imagePrompt,
          imageStyle,
          model,
          reasoningEffort,
          imageModel,
          imageQuality,
          mathEmbeds,
        },
        undefined,
        requestContext,
      );
    }

    const variants = extractVariants(output);

    if (variants.length < VARIANT_COUNT) {
      logError("api.generate", "OpenAI variant parsing failed", {
        ...requestContext,
        parsedVariants: variants.length,
        expectedVariants: VARIANT_COUNT,
        response: responseSummary,
      });

      return finalizeJsonResponse(
        "api.generate",
        request,
        startedAt,
        {
          error: `Expected ${VARIANT_COUNT} variants, but parsed ${variants.length}. Request ID: ${requestId}.`,
          requestId,
        },
        { status: 502 },
        requestContext,
      );
    }

    if (format === "thread") {
      const parsedThreadVariants = variants.map((variant) => extractThread(variant));
      const threadVariants = parsedThreadVariants
        .filter((posts) => posts.length >= 2)
        .slice(0, VARIANT_COUNT);

      if (threadVariants.length < VARIANT_COUNT) {
        const postCounts = parsedThreadVariants.map((posts) => posts.length);

        logError("api.generate", "OpenAI thread parsing failed", {
          ...requestContext,
          parsedVariants: variants.length,
          usableThreadVariants: threadVariants.length,
          expectedVariants: VARIANT_COUNT,
          postCounts,
          response: responseSummary,
        });

        return finalizeJsonResponse(
          "api.generate",
          request,
          startedAt,
          {
            error: `Expected ${VARIANT_COUNT} thread variants with at least 2 posts each, but parsed post counts [${postCounts.join(", ")}]. Request ID: ${requestId}.`,
            requestId,
          },
          { status: 502 },
          requestContext,
        );
      }

      return finalizeJsonResponse(
        "api.generate",
        request,
        startedAt,
        {
          format: "thread",
          variants: threadVariants.map((posts) => ({
            posts: posts.map((text) => ({
              text,
              characters: text.length,
            })),
          })),
        },
        undefined,
        requestContext,
      );
    }

    return finalizeJsonResponse(
      "api.generate",
      request,
      startedAt,
      {
        format: "post",
        variants: variants.map((variant) => {
          const post = normalizePost(variant);

          return {
            post,
            characters: post.length,
          };
        }),
      },
      undefined,
      requestContext,
    );
  } catch (error) {
    logError("api.generate", "OpenAI generation failed", {
      ...requestContext,
      error,
    });

    return finalizeJsonResponse(
      "api.generate",
      request,
      startedAt,
      {
        error: `OpenAI could not generate a post right now. Request ID: ${requestId}.`,
        requestId,
      },
      { status: 500 },
      requestContext,
    );
  }
}
