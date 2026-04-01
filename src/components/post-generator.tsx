"use client";

import Image from "next/image";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import {
  DEFAULT_MEDIUM_IMAGE_STYLE,
  buildMediumLeadImagePrompt,
  getMediumImageStyleLabel,
  mediumImageStyleOptions,
  type MediumImageStyleOption,
} from "@/lib/medium-image";
import { renderMediumMarkdown } from "@/lib/medium-format";
import {
  DEFAULT_FORMAT,
  DEFAULT_PLATFORM,
  DEFAULT_TONE,
  formatOptions,
  MAX_BRIEF_LENGTH,
  MAX_MEDIUM_WORDS,
  MAX_POST_LENGTH,
  platformOptions,
  type FormatOption,
  type PlatformOption,
  type ToneOption,
  toneOptions,
  VARIANT_COUNT,
} from "@/lib/post-config";
import {
  DEFAULT_SHORT_DURATION,
  DEFAULT_SHORT_TARGET,
  getShortEstimatedCostUsd,
  shortDurationOptions,
  shortTargetOptions,
  type ShortDurationOption,
  type ShortTargetOption,
} from "@/lib/short-config";

type PostVariant = {
  post: string;
  characters: number;
};

type ThreadPost = {
  text: string;
  characters: number;
};

type ThreadVariant = {
  posts: ThreadPost[];
};

type PostResult = {
  format: "post";
  variants: PostVariant[];
};

type ThreadResult = {
  format: "thread";
  variants: ThreadVariant[];
};

type MediumResult = {
  format: "medium";
  title: string;
  excerpt: string;
  markdown: string;
  words: number;
  leadImageAlt: string;
  leadImageDataUrl: string | null;
  imagePrompt: string;
  imageStyle: MediumImageStyleOption;
  mathEmbeds: {
    token: string;
    latex: string;
    url: string;
    embedUrl: string;
    width: number;
    height: number;
  }[];
};

type MediumImageResponse = {
  leadImageAlt: string;
  leadImageDataUrl: string;
  imagePrompt: string;
  imageStyle: MediumImageStyleOption;
};

type MediumImageVersion = MediumImageResponse & {
  id: string;
};

type ShortPack = {
  title: string;
  hook: string;
  caption: string;
  hashtags: string[];
  videoPrompt: string;
  shotPlan: string[];
  audioDirection: string;
};

type ShortStatus = "queued" | "in_progress" | "completed" | "failed";

type ShortJob = {
  format: "short";
  jobId: string;
  status: ShortStatus;
  progress: number;
  createdAt: number | null;
  completedAt: number | null;
  expiresAt: number | null;
  seconds: ShortDurationOption;
  size: string;
  model: string;
  target: ShortTargetOption;
  targetLabel: string;
  estimatedCostUsd: number;
  errorMessage: string | null;
};

type ShortResult = ShortJob & {
  pack: ShortPack;
};

type XResponse = PostResult | ThreadResult;
type GenerateResponse = XResponse | MediumResult;
type ShortCreateResponse = ShortResult;
type ShortStatusResponse = ShortJob;
type ComposerTab = PlatformOption | "shorts";

type CopyActionButtonProps = {
  copied: boolean;
  label: string;
  onClick: () => void;
};

const composerTabs = [
  ...platformOptions,
  {
    value: "shorts",
    label: "Shorts",
    helper:
      "Generate one AI-rendered vertical short plus the upload copy and prompt pack.",
  },
] as const;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="8" height="10" rx="1.8" />
      <path d="M3.5 10.5H3A1.5 1.5 0 0 1 1.5 9V3A1.5 1.5 0 0 1 3 1.5h6A1.5 1.5 0 0 1 10.5 3v0.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 5.5V2.5h-3" />
      <path d="M3 10.5v3h3" />
      <path d="M12.2 7A4.5 4.5 0 0 0 4.6 4.3L3 5.5" />
      <path d="M3.8 9A4.5 4.5 0 0 0 11.4 11.7L13 10.5" />
    </svg>
  );
}

function CopyActionButton({
  copied,
  label,
  onClick,
}: CopyActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `${label} copied` : label}
      title={copied ? `${label} copied` : label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
        copied
          ? "border-[#ffb499] bg-[#ffb499]/12 text-[#ffcfbc]"
          : "border-white/12 bg-white/[0.04] text-white/72 hover:border-[#ffb499] hover:text-white"
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="sr-only">{copied ? `${label} copied` : label}</span>
    </button>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono text-xs uppercase tracking-[0.2em] text-white/70"
    >
      {children}
    </label>
  );
}

function ErrorMessage({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <p className="rounded-2xl border border-[#ffb499]/20 bg-[#ffb499]/10 px-4 py-3 text-sm text-[#9f4b2f]">
      {error}
    </p>
  );
}

function StatusPill({ status }: { status: ShortStatus }) {
  const copy =
    status === "completed"
      ? "Completed"
      : status === "failed"
        ? "Failed"
        : status === "queued"
          ? "Queued"
          : "Rendering";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${
        status === "completed"
          ? "border-[#86d0a0]/30 bg-[#86d0a0]/10 text-[#b4f2ca]"
          : status === "failed"
            ? "border-[#ffb499]/30 bg-[#ffb499]/10 text-[#ffcfbc]"
            : "border-[#f6b26b]/30 bg-[#f6b26b]/10 text-[#ffd7ad]"
      }`}
    >
      {copy}
    </span>
  );
}

async function writeClipboard(text: string, html?: string) {
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

async function writeMediumClipboard(result: MediumResult) {
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

function buildMediumClipboardHtml(result: MediumResult) {
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

function replaceMathTokensWithUrls(
  markdown: string,
  mathEmbeds: MediumResult["mathEmbeds"],
) {
  let nextMarkdown = markdown;

  for (const mathEmbed of mathEmbeds) {
    nextMarkdown = nextMarkdown.replace(mathEmbed.token, mathEmbed.url);
  }

  return nextMarkdown;
}

function buildMediumPreviewHtml(result: MediumResult) {
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

function createMediumImageVersion(
  image: MediumImageResponse,
): MediumImageVersion {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `medium-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...image,
  };
}

function buildShortCaptionCopy(pack: ShortPack) {
  const hashtags = pack.hashtags.join(" ");

  return [pack.caption, hashtags].filter(Boolean).join("\n\n");
}

function buildShortPackCopy(result: ShortResult) {
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

function formatUsd(value: number) {
  return usdFormatter.format(value);
}

function formatShortTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-[1rem] border border-dashed border-panel-border/80 bg-white/40 px-4 py-5">
      <p className="max-w-md text-sm leading-7 text-muted">{copy}</p>
    </div>
  );
}

function MediumIdleState() {
  return (
    <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
      <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.04] p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
          Medium Preview
        </p>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
          Ready for one finished draft
        </h3>
        <p className="mt-3 max-w-lg text-sm leading-7 text-white/60">
          Generate a story to preview the full article, lead image, and
          Medium-ready formatting in this pane.
        </p>
      </div>
    </div>
  );
}

function MediumLoadingState() {
  return (
    <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
      <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ffb499]/25 bg-[#ffb499]/10"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ffb499]/30 border-t-[#ffb499]" />
          </span>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
              Medium Draft
            </p>
            <p className="mt-1 text-sm text-white/68">
              Writing your story and preparing the preview.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[1rem] border border-white/8 bg-[#f8f2e8] p-5">
          <div className="animate-pulse space-y-4">
            <div className="h-44 rounded-[1rem] bg-[#ead8c2]" />
            <div className="h-8 w-3/4 rounded-full bg-[#ead8c2]" />
            <div className="space-y-3">
              <div className="h-4 rounded-full bg-[#ead8c2]" />
              <div className="h-4 rounded-full bg-[#ead8c2]" />
              <div className="h-4 w-5/6 rounded-full bg-[#ead8c2]" />
            </div>
            <div className="space-y-3 pt-3">
              <div className="h-5 w-1/3 rounded-full bg-[#ead8c2]" />
              <div className="h-4 rounded-full bg-[#ead8c2]" />
              <div className="h-4 w-11/12 rounded-full bg-[#ead8c2]" />
              <div className="h-4 w-4/5 rounded-full bg-[#ead8c2]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposerPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!active}
      className={active ? "block" : "hidden"}
    >
      {children}
    </div>
  );
}

function XComposer() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [format, setFormat] = useState<FormatOption>(DEFAULT_FORMAT);
  const [result, setResult] = useState<XResponse | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");
  const [isPending, startTransition] = useTransition();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBrief = brief.trim();
    const nextTone = tone;
    const nextFormat = format;

    startTransition(async () => {
      setError("");
      setCopyState("");

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platform: "x",
            brief: nextBrief,
            tone: nextTone,
            format: nextFormat,
          }),
        });

        const payload = (await response.json()) as
          | GenerateResponse
          | { error?: string };

        if (
          !response.ok ||
          !("format" in payload) ||
          (payload.format !== "post" && payload.format !== "thread")
        ) {
          setResult(null);
          setError(
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "The X draft could not be generated. Try again.",
          );
          return;
        }

        setResult(payload);
      } catch {
        setResult(null);
        setError("The request failed. Check your connection and try again.");
      }
    });
  }

  async function handleCopy(text: string, key: string) {
    try {
      await writeClipboard(text);
      setCopyState(key);
      window.setTimeout(() => {
        setCopyState((current) => (current === key ? "" : current));
      }, 1600);
    } catch {
      setError("Copy failed. You can still select the text manually.");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffb499]">
              X Composer
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Generate posts and threads
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/68">
              Fast short-form writing for X. Keep the input raw and specific.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="x-brief">Topic or short brief</FieldLabel>
              <textarea
                id="x-brief"
                rows={8}
                maxLength={MAX_BRIEF_LENGTH}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Example: I shipped a small internal automation that saves me 45 minutes every morning. I want a post about why small boring tools compound."
                className="w-full resize-none rounded-[1.15rem] border border-white/12 bg-white/[0.06] px-3.5 py-3.5 text-base leading-7 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
                required
              />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>Give it one sharp idea or concrete claim.</span>
                <span>{briefRemaining} left</span>
              </div>
            </div>

            <div className="space-y-2">
              <fieldset className="space-y-2">
                <legend className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">
                  Output type
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {formatOptions.map((option) => {
                    const active = format === option.value;
                    const inputId = `x-format-${option.value}`;

                    return (
                      <div
                        key={option.value}
                        className={`rounded-[1rem] border px-3.5 py-2.5 transition ${
                          active
                            ? "border-[#ffb499] bg-[#ffb499]/12"
                            : "border-white/12 bg-white/[0.04]"
                        }`}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="x-format"
                          value={option.value}
                          checked={active}
                          onChange={(event) =>
                            setFormat(event.target.value as FormatOption)
                          }
                          className="sr-only"
                        />
                        <label htmlFor={inputId} className="block cursor-pointer">
                          <p className="text-sm font-medium text-white">
                            {option.label}
                          </p>
                          <p className="mt-1 text-xs leading-6 text-white/55">
                            {option.helper}
                          </p>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="x-tone">Tone</FieldLabel>
              <select
                id="x-tone"
                value={tone}
                onChange={(event) => setTone(event.target.value as ToneOption)}
                className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
              >
                {toneOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#171717]"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending || brief.trim().length < 12}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
            >
              {isPending
                ? "Writing..."
                : format === "thread"
                  ? `Generate ${VARIANT_COUNT} thread variants`
                  : `Generate ${VARIANT_COUNT} post variants`}
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        {result ? (
          result.format === "thread" ? (
            <div className="grid gap-2.5 lg:grid-cols-3">
              {result.variants.map((variant, variantIndex) => (
                <div
                  key={`thread-variant-${variantIndex}`}
                  className="rounded-[0.9rem] border border-panel-border bg-[#171717] p-3 text-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                      Variant {variantIndex + 1}
                    </p>
                    <CopyActionButton
                      copied={copyState === `thread-${variantIndex}`}
                      label={`Copy variant ${variantIndex + 1} thread`}
                      onClick={() =>
                        handleCopy(
                          variant.posts
                            .map(
                              (post, index) =>
                                `${index + 1}/${variant.posts.length}\n${post.text}`,
                            )
                            .join("\n\n"),
                          `thread-${variantIndex}`,
                        )
                      }
                    />
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {variant.posts.map((post, postIndex) => (
                      <div
                        key={`thread-${variantIndex}-post-${postIndex}`}
                        className="rounded-[0.8rem] border border-white/8 bg-white/[0.03] p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                            {postIndex + 1}/{variant.posts.length}
                          </p>
                          <CopyActionButton
                            copied={
                              copyState ===
                              `thread-${variantIndex}-post-${postIndex}`
                            }
                            label={`Copy post ${postIndex + 1} from variant ${variantIndex + 1}`}
                            onClick={() =>
                              handleCopy(
                                post.text,
                                `thread-${variantIndex}-post-${postIndex}`,
                              )
                            }
                          />
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6 text-white">
                          {post.text}
                        </p>
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                          {post.characters}/{MAX_POST_LENGTH} characters
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-2.5 lg:grid-cols-3">
              {result.variants.map((variant, index) => (
                <div
                  key={`post-variant-${index}`}
                  className="rounded-[0.9rem] border border-panel-border bg-[#171717] p-3 text-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                      Variant {index + 1}
                    </p>
                    <CopyActionButton
                      copied={copyState === `post-${index}`}
                      label={`Copy variant ${index + 1} post`}
                      onClick={() => handleCopy(variant.post, `post-${index}`)}
                    />
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap break-words text-base leading-6.5 text-white">
                    {variant.post}
                  </p>
                  <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                    {variant.characters}/{MAX_POST_LENGTH} characters
                  </p>
                </div>
              ))}
            </div>
          )
        ) : (
          <EmptyState copy="Your generated X post or thread variants will appear here." />
        )}

        <ErrorMessage error={error} />
      </section>
    </div>
  );
}

function MediumComposer() {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("Teach a practical lesson");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [imageStyle, setImageStyle] = useState<MediumImageStyleOption>(
    DEFAULT_MEDIUM_IMAGE_STYLE,
  );
  const [imagePrompt, setImagePrompt] = useState("");
  const [imagePromptEdited, setImagePromptEdited] = useState(false);
  const [includeCode, setIncludeCode] = useState(true);
  const [result, setResult] = useState<MediumResult | null>(null);
  const [imageHistory, setImageHistory] = useState<MediumImageVersion[]>([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isPending, startTransition] = useTransition();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;
  const suggestedImagePrompt = buildMediumLeadImagePrompt({
    brief,
    audience,
    mediumGoal: goal,
    imageStyle,
  });
  const selectedImage =
    imageHistory.find((image) => image.id === selectedImageId) ??
    imageHistory[0] ??
    null;
  const activeResult = result
    ? {
        ...result,
        leadImageAlt: selectedImage?.leadImageAlt ?? result.leadImageAlt,
        leadImageDataUrl:
          selectedImage?.leadImageDataUrl ?? result.leadImageDataUrl,
        imagePrompt: selectedImage?.imagePrompt ?? result.imagePrompt,
        imageStyle: selectedImage?.imageStyle ?? result.imageStyle,
      }
    : null;

  useEffect(() => {
    if (!imagePromptEdited) {
      setImagePrompt(suggestedImagePrompt);
    }
  }, [imagePromptEdited, suggestedImagePrompt]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBrief = brief.trim();
    const nextAudience = audience.trim();
    const nextGoal = goal;
    const nextTone = tone;
    const nextImageStyle = imageStyle;
    const nextImagePrompt = imagePrompt.trim();
    const nextIncludeCode = includeCode;

    startTransition(async () => {
      setError("");
      setCopyState("");

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platform: "medium",
            brief: nextBrief,
            tone: nextTone,
            audience: nextAudience,
            mediumGoal: nextGoal,
            imageStyle: nextImageStyle,
            imagePrompt: nextImagePrompt,
            includeCode: nextIncludeCode,
          }),
        });

        const payload = (await response.json()) as
          | GenerateResponse
          | { error?: string };

        if (!response.ok || !("format" in payload) || payload.format !== "medium") {
          setResult(null);
          setImageHistory([]);
          setSelectedImageId("");
          setError(
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "The Medium story could not be generated. Try again.",
          );
          return;
        }

        setResult(payload);
        const nextImageHistory =
          payload.leadImageDataUrl &&
          typeof payload.imagePrompt === "string" &&
          payload.imageStyle
            ? [
                createMediumImageVersion({
                  leadImageAlt: payload.leadImageAlt,
                  leadImageDataUrl: payload.leadImageDataUrl,
                  imagePrompt: payload.imagePrompt,
                  imageStyle: payload.imageStyle,
                }),
              ]
            : [];
        setImageHistory(nextImageHistory);
        setSelectedImageId(nextImageHistory[0]?.id ?? "");
        setImageStyle(payload.imageStyle);
        setIsRefreshingImage(false);

        if (!imagePromptEdited) {
          setImagePrompt(payload.imagePrompt);
        }
      } catch {
        setResult(null);
        setImageHistory([]);
        setSelectedImageId("");
        setError("The request failed. Check your connection and try again.");
      }
    });
  }

  async function handleCopy(nextResult: MediumResult) {
    try {
      await writeMediumClipboard(nextResult);
      setCopyState("medium-story");
      window.setTimeout(() => {
        setCopyState((current) => (current === "medium-story" ? "" : current));
      }, 1600);
    } catch {
      setError("Copy failed. You can still select the story manually.");
    }
  }

  async function handleRefreshImage() {
    if (!result || isRefreshingImage) {
      return;
    }

    setError("");
    setIsRefreshingImage(true);

    try {
      const response = await fetch("/api/generate-medium-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brief: brief.trim(),
          audience: audience.trim(),
          mediumGoal: goal,
          imageStyle,
          imagePrompt: imagePrompt.trim(),
          title: result.title,
          excerpt: result.excerpt,
        }),
      });

      const payload = (await response.json()) as
        | MediumImageResponse
        | { error?: string };

      if (
        !response.ok ||
        !("leadImageDataUrl" in payload) ||
        typeof payload.leadImageDataUrl !== "string"
      ) {
        setError(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "A new lead image could not be generated. Try again.",
        );
        return;
      }

      const nextImage = createMediumImageVersion(payload);
      setResult((current) =>
        current
          ? {
              ...current,
              leadImageAlt: payload.leadImageAlt,
              leadImageDataUrl: payload.leadImageDataUrl,
              imagePrompt: payload.imagePrompt,
              imageStyle: payload.imageStyle,
            }
          : current,
      );
      setImageHistory((current) => [nextImage, ...current].slice(0, 6));
      setSelectedImageId(nextImage.id);

      if (!imagePromptEdited) {
        setImagePrompt(payload.imagePrompt);
      }
    } catch {
      setError("The image refresh failed. Check your connection and try again.");
    } finally {
      setIsRefreshingImage(false);
    }
  }

  const previewHtml = activeResult ? buildMediumPreviewHtml(activeResult) : "";
  const currentImageStyleLabel = activeResult
    ? getMediumImageStyleLabel(activeResult.imageStyle)
    : getMediumImageStyleLabel(imageStyle);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffb499]">
              Medium Studio
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Generate one paste-ready story
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/68">
              This flow is built for long-form writing. It shapes one complete
              article for Medium instead of multiple short variants.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="medium-brief">Story seed</FieldLabel>
              <textarea
                id="medium-brief"
                rows={9}
                maxLength={MAX_BRIEF_LENGTH}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Example: I built a boring internal dashboard that removed three weekly meetings. I want a Medium story about why unglamorous tooling creates strategic leverage."
                className="w-full resize-none rounded-[1.15rem] border border-white/12 bg-white/[0.06] px-3.5 py-3.5 text-base leading-7 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
                required
              />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>Include the core point, examples, and why it matters.</span>
                <span>{briefRemaining} left</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="medium-audience">Target reader</FieldLabel>
                <input
                  id="medium-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="Founders, engineers, growth teams..."
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="medium-goal">Article goal</FieldLabel>
                <select
                  id="medium-goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  <option className="bg-[#171717]">Teach a practical lesson</option>
                  <option className="bg-[#171717]">
                    Tell a story with a takeaway
                  </option>
                  <option className="bg-[#171717]">
                    Make an argument with examples
                  </option>
                  <option className="bg-[#171717]">Break down a workflow</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="medium-tone">Voice</FieldLabel>
                <select
                  id="medium-tone"
                  value={tone}
                  onChange={(event) => setTone(event.target.value as ToneOption)}
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {toneOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#171717]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="medium-image-style">Image type</FieldLabel>
                <select
                  id="medium-image-style"
                  value={imageStyle}
                  onChange={(event) =>
                    setImageStyle(event.target.value as MediumImageStyleOption)
                  }
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {mediumImageStyleOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#171717]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="medium-image-prompt">
                  Lead image prompt
                </FieldLabel>
                <button
                  type="button"
                  onClick={() => {
                    setImagePromptEdited(false);
                    setImagePrompt(suggestedImagePrompt);
                  }}
                  className="text-xs font-medium text-[#ffb499] transition hover:text-[#ffd1bf]"
                >
                  Use suggested prompt
                </button>
              </div>
              <textarea
                id="medium-image-prompt"
                rows={6}
                value={imagePrompt}
                onChange={(event) => {
                  setImagePromptEdited(true);
                  setImagePrompt(event.target.value);
                }}
                placeholder="Describe the Medium lead image you want."
                className="w-full resize-y rounded-[1.05rem] border border-white/12 bg-white/[0.06] px-3.5 py-3 text-[9px] leading-4 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
              />
              <p className="text-xs leading-6 text-white/45">
                This prompt controls the Medium hero image only. Keep it simple,
                specific, and visual.
              </p>
            </div>

            <label className="inline-flex items-center gap-3 rounded-[0.95rem] border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={includeCode}
                  onChange={(event) => setIncludeCode(event.target.checked)}
                  className="h-4 w-4 accent-[#f6b26b]"
                />
                Include code if relevant
            </label>

            <button
              type="submit"
              disabled={isPending || brief.trim().length < 12}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
            >
              {isPending ? "Writing..." : "Generate Medium story"}
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        {isPending ? (
          <MediumLoadingState />
        ) : activeResult ? (
          <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                    Medium Draft
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                    {activeResult.words} words · rich-text copy enabled ·{" "}
                    {currentImageStyleLabel}
                    {activeResult.mathEmbeds.length > 0
                      ? ` · ${activeResult.mathEmbeds.length} math embed${activeResult.mathEmbeds.length > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeResult.leadImageDataUrl ? (
                    <a
                      href={activeResult.leadImageDataUrl}
                      download="medium-lead-image.png"
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                    >
                      Download image
                    </a>
                  ) : null}
                  <CopyActionButton
                    copied={copyState === "medium-story"}
                    label="Copy Medium story"
                    onClick={() => handleCopy(activeResult)}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-[1rem] border border-white/8 bg-[#f8f2e8] p-5 text-[#171717]">
                {activeResult.leadImageDataUrl ? (
                  <div className="mb-5">
                    <div className="relative overflow-hidden rounded-[1rem] border border-[#dbc7af] bg-[#efe2d0]">
                      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
                        <span className="rounded-full border border-white/40 bg-[#171717]/65 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
                          {currentImageStyleLabel}
                        </span>
                        <button
                          type="button"
                          onClick={handleRefreshImage}
                          disabled={isRefreshingImage}
                          className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-[#171717]/72 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#171717]/86 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <span
                            className={
                              isRefreshingImage ? "animate-spin" : undefined
                            }
                          >
                            <RefreshIcon />
                          </span>
                          {isRefreshingImage ? "Refreshing..." : "Refresh image"}
                        </button>
                      </div>

                      {isRefreshingImage ? (
                        <div className="absolute inset-0 z-0 bg-[#171717]/18" />
                      ) : null}

                      {isRefreshingImage ? (
                        <div className="absolute inset-0 z-20 flex items-center justify-center">
                          <div className="rounded-full border border-white/35 bg-[#171717]/75 px-4 py-2 text-xs font-medium text-white shadow-lg">
                            Generating a new image...
                          </div>
                        </div>
                      ) : null}

                      <Image
                        src={activeResult.leadImageDataUrl}
                        alt={activeResult.leadImageAlt}
                        width={1536}
                        height={1024}
                        unoptimized
                        className={`aspect-[3/2] w-full object-cover transition ${
                          isRefreshingImage ? "opacity-55" : ""
                        }`}
                      />
                    </div>

                    {imageHistory.length > 1 ? (
                      <div className="mt-3 space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d6653]">
                          Image takes
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {imageHistory.map((image, index) => {
                            const active = image.id === selectedImage?.id;

                            return (
                              <button
                                key={image.id}
                                type="button"
                                onClick={() => setSelectedImageId(image.id)}
                                className={`overflow-hidden rounded-[0.95rem] border text-left transition ${
                                  active
                                    ? "border-[#a54521] ring-2 ring-[#a54521]/18"
                                    : "border-[#dbc7af] hover:border-[#c78657]"
                                }`}
                              >
                                <div className="relative h-16 w-24 bg-[#efe2d0]">
                                  <Image
                                    src={image.leadImageDataUrl}
                                    alt={image.leadImageAlt}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                  />
                                </div>
                                <div className="bg-[#f4e7d6] px-2 py-1.5">
                                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7d6653]">
                                    Take {imageHistory.length - index}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[#4f3b2b]">
                                    {getMediumImageStyleLabel(image.imageStyle)}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : result ? (
                  <div className="mb-5 rounded-[1rem] border border-dashed border-[#dbc7af] bg-[#efe2d0] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d6653]">
                          Lead image
                        </p>
                        <p className="mt-1 text-sm text-[#5f4b3c]">
                          No image was returned for this draft yet.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshImage}
                        disabled={isRefreshingImage}
                        className="inline-flex items-center gap-2 rounded-full border border-[#c78657] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#7a3316] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <RefreshIcon />
                        {isRefreshingImage ? "Generating..." : "Generate image"}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div
                  className={[
                    "space-y-4 text-[15px] leading-7",
                    "[&_a]:text-[#a54521] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#d9a16c] [&_blockquote]:pl-4 [&_blockquote]:text-[#5f4b3c]",
                    "[&_code]:rounded [&_code]:bg-[#ead8c2] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-[#3b2d20]",
                    "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] [&_h1]:text-[#171717]",
                    "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em]",
                    "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-[-0.02em]",
                    "[&_iframe]:w-full [&_.medium-math-embed]:my-5 [&_.medium-math-embed]:overflow-x-auto [&_.medium-math-embed]:rounded-[0.9rem] [&_.medium-math-embed]:border [&_.medium-math-embed]:border-[#dbc7af] [&_.medium-math-embed]:bg-white",
                    "[&_li]:mb-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:text-[#2b251f] [&_pre]:overflow-x-auto [&_pre]:rounded-[0.9rem] [&_pre]:border [&_pre]:border-[#dbc7af] [&_pre]:bg-[#f4e7d6] [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-[#2a2018] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#2a2018]",
                    "[&_ul]:ml-5 [&_ul]:list-disc",
                  ].join(" ")}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>

              <p className="mt-3 text-xs leading-6 text-white/52">
                Copy sends both markdown and rich HTML, including the lead image
                when it is available, so pasting into Medium preserves the article
                structure as closely as possible. Mathematical display equations
                are exported as Medium-supported embed links rather than raw
                LaTeX. Stories are capped at about {MAX_MEDIUM_WORDS} words.
              </p>
            </div>
          </div>
        ) : (
          <MediumIdleState />
        )}

        <ErrorMessage error={error} />
      </section>
    </div>
  );
}

function ShortComposer() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [target, setTarget] = useState<ShortTargetOption>(DEFAULT_SHORT_TARGET);
  const [duration, setDuration] =
    useState<ShortDurationOption>(DEFAULT_SHORT_DURATION);
  const [result, setResult] = useState<ShortResult | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");
  const [isPending, startTransition] = useTransition();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;
  const estimatedCost = formatUsd(getShortEstimatedCostUsd(duration));
  const pollingJobId = result?.jobId;
  const pollingTarget = result?.target;
  const pollingStatus = result?.status;
  const createdAtCopy = formatShortTimestamp(result?.createdAt ?? null);
  const completedAtCopy = formatShortTimestamp(result?.completedAt ?? null);

  async function refreshShortStatusNow(
    jobId: string,
    nextTarget: ShortTargetOption,
  ) {
    try {
      const response = await fetch(
        `/api/generate-short?jobId=${encodeURIComponent(jobId)}&target=${encodeURIComponent(nextTarget)}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as
        | ShortStatusResponse
        | { error?: string };

      if (!response.ok || !("format" in payload) || payload.format !== "short") {
        setError(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "The short status could not be refreshed. Try again.",
        );
        return;
      }

      setResult((current) =>
        current && current.jobId === jobId ? { ...current, ...payload } : current,
      );

      setError(payload.errorMessage ?? "");
    } catch {
      setError("The short status could not be refreshed. Retrying automatically.");
    }
  }

  const refreshShortStatus = useEffectEvent(
    async (jobId: string, nextTarget: ShortTargetOption) => {
      await refreshShortStatusNow(jobId, nextTarget);
    },
  );

  useEffect(() => {
    if (
      !pollingJobId ||
      !pollingTarget ||
      pollingStatus === "completed" ||
      pollingStatus === "failed"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshShortStatus(pollingJobId, pollingTarget);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pollingJobId, pollingStatus, pollingTarget]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBrief = brief.trim();
    const nextTone = tone;
    const nextTarget = target;
    const nextDuration = duration;

    startTransition(async () => {
      setError("");
      setCopyState("");
      setResult(null);

      try {
        const response = await fetch("/api/generate-short", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brief: nextBrief,
            tone: nextTone,
            target: nextTarget,
            duration: nextDuration,
          }),
        });

        const payload = (await response.json()) as
          | ShortCreateResponse
          | { error?: string };

        if (!response.ok || !("format" in payload) || payload.format !== "short") {
          setError(
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "The AI short could not be started. Try again.",
          );
          return;
        }

        setResult(payload);
        setError(payload.errorMessage ?? "");
      } catch {
        setError("The request failed. Check your connection and try again.");
      }
    });
  }

  async function handleCopy(text: string, key: string) {
    try {
      await writeClipboard(text);
      setCopyState(key);
      window.setTimeout(() => {
        setCopyState((current) => (current === key ? "" : current));
      }, 1600);
    } catch {
      setError("Copy failed. You can still select the text manually.");
    }
  }

  const videoUrl =
    result?.status === "completed"
      ? `/api/generate-short/download?jobId=${encodeURIComponent(result.jobId)}`
      : "";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffb499]">
              Shorts Lab
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Generate one AI video short
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/68">
              This flow is fully separate from X and Medium. It creates one
              portrait video render plus the upload copy you can reuse across
              YouTube Shorts, Reels, or TikTok.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="short-brief">Short concept</FieldLabel>
              <textarea
                id="short-brief"
                rows={9}
                maxLength={MAX_BRIEF_LENGTH}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Example: Create a tight 8-second short showing how small internal automations quietly save hours every week, with cinematic desk details and one satisfying payoff moment."
                className="w-full resize-none rounded-[1.15rem] border border-white/12 bg-white/[0.06] px-3.5 py-3.5 text-base leading-7 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
                required
              />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>Describe the idea, the visual mood, and the payoff.</span>
                <span>{briefRemaining} left</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="short-target">Publish target</FieldLabel>
                <select
                  id="short-target"
                  value={target}
                  onChange={(event) =>
                    setTarget(event.target.value as ShortTargetOption)
                  }
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {shortTargetOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#171717]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-6 text-white/45">
                  {
                    shortTargetOptions.find((option) => option.value === target)
                      ?.helper
                  }
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="short-duration">Duration</FieldLabel>
                <select
                  id="short-duration"
                  value={duration}
                  onChange={(event) =>
                    setDuration(event.target.value as ShortDurationOption)
                  }
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {shortDurationOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-[#171717]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-6 text-white/45">
                  {
                    shortDurationOptions.find(
                      (option) => option.value === duration,
                    )?.helper
                  }
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="short-tone">Tone</FieldLabel>
              <select
                id="short-tone"
                value={tone}
                onChange={(event) => setTone(event.target.value as ToneOption)}
                className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
              >
                {toneOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#171717]"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[1rem] border border-[#f6b26b]/20 bg-[#f6b26b]/8 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffd7ad]">
                Cost-aware default
              </p>
              <p className="mt-2 text-sm leading-7 text-white/74">
                Uses a portrait social render and keeps the default at{" "}
                {DEFAULT_SHORT_DURATION} seconds. Estimated video cost for this
                render: {estimatedCost}.
              </p>
            </div>

            <button
              type="submit"
              disabled={isPending || brief.trim().length < 12}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
            >
              {isPending
                ? "Starting render..."
                : `Generate ${duration}-second AI short`}
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        {result ? (
          <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                    AI Short
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                    {result.targetLabel} · {result.seconds}s · {result.size} ·{" "}
                    {formatUsd(result.estimatedCostUsd)} est.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={result.status} />
                  {result.status === "completed" ? (
                    <a
                      href={`/api/generate-short/download?jobId=${encodeURIComponent(result.jobId)}&download=1`}
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                    >
                      Download video
                    </a>
                  ) : null}
                  <CopyActionButton
                    copied={copyState === "short-pack"}
                    label="Copy full short pack"
                    onClick={() => handleCopy(buildShortPackCopy(result), "short-pack")}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-[1rem] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Render status
                    </p>
                    <p className="mt-1 text-xs leading-6 text-white/52">
                      Job ID {result.jobId}
                      {createdAtCopy ? ` · started ${createdAtCopy}` : ""}
                      {completedAtCopy ? ` · finished ${completedAtCopy}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status !== "completed" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void refreshShortStatusNow(result.jobId, result.target)
                        }
                        className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                      >
                        Refresh now
                      </button>
                    ) : null}
                    <p className="font-mono text-sm uppercase tracking-[0.16em] text-[#ffd7ad]">
                      {Math.max(0, Math.min(100, result.progress))}%
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[#f6b26b] transition-[width] duration-500"
                    style={{
                      width: `${Math.max(8, Math.min(100, result.progress))}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-sm leading-7 text-white/64">
                  {result.status === "completed"
                    ? "Your video is ready. Preview it here or download the MP4 for upload."
                    : result.status === "failed"
                      ? result.errorMessage ||
                        "The render failed. Adjust the brief and try again."
                      : result.status === "queued"
                        ? "The render has been accepted and is waiting in the provider queue. The app keeps polling every 10 seconds, and you can also refresh manually."
                        : "The render is in progress. You can stay on this tab and it will keep polling automatically."}
                </p>
              </div>

              {result.status === "completed" ? (
                <div className="mt-4 overflow-hidden rounded-[1rem] border border-white/8 bg-black">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={videoUrl}
                    className="aspect-[9/16] w-full bg-black object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                      Upload copy
                    </p>
                    <CopyActionButton
                      copied={copyState === "short-caption"}
                      label="Copy short caption"
                      onClick={() =>
                        handleCopy(
                          buildShortCaptionCopy(result.pack),
                          "short-caption",
                        )
                      }
                    />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">
                    {result.pack.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#ffd7ad]">
                    {result.pack.hook}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/80">
                    {result.pack.caption}
                  </p>
                  {result.pack.hashtags.length > 0 ? (
                    <p className="mt-4 text-xs leading-6 text-white/52">
                      {result.pack.hashtags.join(" ")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                      Video prompt
                    </p>
                    <CopyActionButton
                      copied={copyState === "short-prompt"}
                      label="Copy video prompt"
                      onClick={() =>
                        handleCopy(result.pack.videoPrompt, "short-prompt")
                      }
                    />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/78">
                    {result.pack.videoPrompt}
                  </p>
                </div>

                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                    Shot plan
                  </p>
                  <div className="mt-3 space-y-2">
                    {result.pack.shotPlan.map((shot, index) => (
                      <div
                        key={`${result.jobId}-shot-${index}`}
                        className="rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2.5"
                      >
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                          Beat {index + 1}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/78">
                          {shot}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                    Audio direction
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/78">
                    {result.pack.audioDirection}
                  </p>
                  <p className="mt-4 text-xs leading-6 text-white/48">
                    The video prompt avoids text overlays and branding so the
                    clip stays reusable across platforms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState copy="Your AI short will appear here with the render status, video preview, upload caption, and reusable prompt pack." />
        )}

        <ErrorMessage error={error} />
      </section>
    </div>
  );
}

export function PostGenerator() {
  const [platform, setPlatform] = useState<ComposerTab>(DEFAULT_PLATFORM);

  return (
    <div className="space-y-4">
      <section className="rounded-[1.35rem] border border-panel-border bg-panel/80 p-2 shadow-[0_20px_60px_rgba(23,23,23,0.08)]">
        <div className="grid gap-2 sm:grid-cols-3">
          {composerTabs.map((option) => {
            const active = platform === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPlatform(option.value)}
                className={`rounded-[1.1rem] border px-4 py-3 text-left transition ${
                  active
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-panel-border bg-white/40 text-[#171717] hover:bg-white/70"
                }`}
              >
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#c7522a]">
                  {option.label}
                </p>
                <p
                  className={`mt-1 text-sm leading-6 ${
                    active ? "text-white/70" : "text-muted"
                  }`}
                >
                  {option.helper}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <ComposerPanel active={platform === "x"}>
        <XComposer />
      </ComposerPanel>
      <ComposerPanel active={platform === "medium"}>
        <MediumComposer />
      </ComposerPanel>
      <ComposerPanel active={platform === "shorts"}>
        <ShortComposer />
      </ComposerPanel>
    </div>
  );
}
