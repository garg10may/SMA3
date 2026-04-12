import { renderMediumMarkdown } from "@/lib/medium-format";
import type {
  ErrorResponse,
  MediumImageResponse,
  MediumImageVersion,
  MediumResult,
  ShortPack,
  ShortResult,
} from "@/components/post-generator/types";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export async function readResponsePayload<T>(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T | ErrorResponse;
  }

  const text = (await response.text()).trim();

  return text ? ({ error: text } as ErrorResponse) : ({} as ErrorResponse);
}

export function readErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error
  ) {
    return payload.error;
  }

  return fallback;
}

export async function writeClipboard(text: string, html?: string) {
  if (
    html &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard.write === "function"
  ) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return;
  }

  await navigator.clipboard.writeText(text);
}

export async function writeMediumClipboard(result: MediumResult) {
  const html = buildMediumClipboardHtml(result);
  const plainText = replaceMathTokensWithUrls(result.markdown, result.mathEmbeds);

  if (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard.write === "function"
  ) {
    const clipboardData: Record<string, Blob> = {};

    if (result.leadImageDataUrl) {
      const imageResponse = await fetch(result.leadImageDataUrl);
      const imageBlob = await imageResponse.blob();
      clipboardData[imageBlob.type || "image/png"] = imageBlob;
    }

    clipboardData["text/html"] = new Blob([html], { type: "text/html" });
    clipboardData["text/plain"] = new Blob([plainText], {
      type: "text/plain",
    });

    await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
    return;
  }

  await navigator.clipboard.writeText(plainText);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildMediumClipboardHtml(result: MediumResult) {
  const storyHtml = renderMediumMarkdown(
    replaceMathTokensWithUrls(result.markdown, result.mathEmbeds),
  );

  if (!result.leadImageDataUrl) {
    return storyHtml;
  }

  return `<figure><img src="${result.leadImageDataUrl}" alt="${escapeHtml(
    result.leadImageAlt,
  )}" /></figure>${storyHtml}`;
}

export function replaceMathTokensWithUrls(
  markdown: string,
  mathEmbeds: MediumResult["mathEmbeds"],
) {
  let nextMarkdown = markdown;

  for (const mathEmbed of mathEmbeds) {
    nextMarkdown = nextMarkdown.replace(mathEmbed.token, mathEmbed.url);
  }

  return nextMarkdown;
}

export function buildMediumPreviewHtml(result: MediumResult) {
  let html = renderMediumMarkdown(result.markdown);

  for (const mathEmbed of result.mathEmbeds) {
    const tokenMarkup = `<p>${escapeHtml(mathEmbed.token)}</p>`;
    const iframeMarkup = `<div class="medium-math-embed"><iframe src="${mathEmbed.embedUrl}" width="${mathEmbed.width}" height="${mathEmbed.height}" frameborder="0" scrolling="no" title="${escapeHtml(
      `Math equation ${mathEmbed.latex}`,
    )}"></iframe></div>`;

    html = html.replace(tokenMarkup, iframeMarkup);
  }

  return html;
}

export function createMediumImageVersion(
  image: MediumImageResponse,
): MediumImageVersion {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `medium-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...image,
  };
}

export function buildShortCaptionCopy(pack: ShortPack) {
  const hashtags = pack.hashtags.join(" ");

  return [pack.caption, hashtags].filter(Boolean).join("\n\n");
}

export function buildShortPackCopy(result: ShortResult) {
  return [
    `Title: ${result.pack.title}`,
    `Hook: ${result.pack.hook}`,
    `Caption:\n${buildShortCaptionCopy(result.pack)}`,
    `Audio: ${result.pack.audioDirection}`,
    `Video prompt:\n${result.pack.videoPrompt}`,
    `Shot plan:\n${result.pack.shotPlan
      .map((shot, index) => `${index + 1}. ${shot}`)
      .join("\n")}`,
  ].join("\n\n");
}

export function formatUsd(value: number) {
  return usdFormatter.format(value);
}

export function formatShortTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
