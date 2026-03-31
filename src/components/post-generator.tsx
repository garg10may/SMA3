"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_FORMAT,
  DEFAULT_TONE,
  formatOptions,
  type FormatOption,
  isFormatOption,
  MAX_BRIEF_LENGTH,
  MAX_POST_LENGTH,
  type ToneOption,
  toneOptions,
  VARIANT_COUNT,
} from "@/lib/post-config";

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

type GenerateResponse = PostResult | ThreadResult;

export function PostGenerator() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [format, setFormat] = useState<FormatOption>(DEFAULT_FORMAT);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;

  function handleSubmit(formData: FormData) {
    const nextBrief = String(formData.get("brief") ?? "").trim();
    const nextTone = String(formData.get("tone") ?? DEFAULT_TONE) as ToneOption;
    const rawFormat = String(formData.get("format") ?? DEFAULT_FORMAT);
    const nextFormat = isFormatOption(rawFormat) ? rawFormat : DEFAULT_FORMAT;

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
          const message =
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "The post could not be generated. Try again.";
          setError(
            message,
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
      await navigator.clipboard.writeText(text);
      setCopyState(key);
    } catch {
      setError("Copy failed. You can still select the text manually.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-panel-border bg-[#171717] p-4 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-5">
        <div className="rounded-[1.65rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffb499]">
              Generate
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Draft a post from your brief
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/68">
              Keep the input raw. A rough note is enough.
            </p>
          </div>

          <form action={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="brief"
                className="font-mono text-xs uppercase tracking-[0.2em] text-white/70"
              >
                Topic or short brief
              </label>
              <textarea
                id="brief"
                name="brief"
                rows={8}
                maxLength={MAX_BRIEF_LENGTH}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Example: I shipped a small internal automation that saves me 45 minutes every morning. I want a post about why small boring tools compound."
                className="w-full resize-none rounded-[1.4rem] border border-white/12 bg-white/[0.06] px-4 py-4 text-base leading-7 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
                required
              />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>Be specific enough to give the model a clear angle.</span>
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
                    const inputId = `format-${option.value}`;

                    return (
                      <div
                        key={option.value}
                        className={`rounded-[1.15rem] border px-4 py-3 transition ${
                          active
                            ? "border-[#ffb499] bg-[#ffb499]/12"
                            : "border-white/12 bg-white/[0.04]"
                        }`}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="format"
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
              <label
                htmlFor="tone"
                className="font-mono text-xs uppercase tracking-[0.2em] text-white/70"
              >
                Tone
              </label>
              <select
                id="tone"
                name="tone"
                value={tone}
                onChange={(event) => setTone(event.target.value as ToneOption)}
                className="w-full rounded-[1rem] border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ffb499]"
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
              className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-3 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
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

      <section className="rounded-[2rem] border border-panel-border bg-panel p-4 shadow-[0_24px_80px_rgba(32,24,16,0.08)] backdrop-blur sm:p-5">
        <div className="rounded-[1.65rem] border border-panel-border bg-white/45 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Output
              </p>
              <p className="mt-1 text-sm text-muted">
                {result?.format === "thread"
                  ? `${VARIANT_COUNT} thread variants, with each post trimmed to ${MAX_POST_LENGTH} characters.`
                  : `${VARIANT_COUNT} post variants, each trimmed to ${MAX_POST_LENGTH} characters.`}
              </p>
            </div>
          </div>

          <div className="mt-4 min-h-44 rounded-[1.2rem] border border-dashed border-panel-border bg-white/55 p-4">
            {result ? (
              result.format === "thread" ? (
                <div className="grid gap-4 xl:grid-cols-3">
                  {result.variants.map((variant, variantIndex) => (
                    <div
                      key={`thread-variant-${variantIndex}`}
                      className="flex h-full flex-col rounded-[1rem] border border-panel-border bg-[#171717] p-4 text-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                          Variant {variantIndex + 1}
                        </p>
                        <button
                          type="button"
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
                          className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/78 transition hover:border-[#ffb499] hover:text-white"
                        >
                          {copyState === `thread-${variantIndex}`
                            ? "Copied"
                            : "Copy thread"}
                        </button>
                      </div>
                      <div className="mt-4 space-y-4">
                        {variant.posts.map((post, postIndex) => (
                          <div
                            key={`thread-${variantIndex}-post-${postIndex}`}
                            className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                                {postIndex + 1}/{variant.posts.length}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(
                                    post.text,
                                    `thread-${variantIndex}-post-${postIndex}`,
                                  )
                                }
                                className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/78 transition hover:border-[#ffb499] hover:text-white"
                              >
                                {copyState ===
                                `thread-${variantIndex}-post-${postIndex}`
                                  ? "Copied"
                                  : "Copy post"}
                              </button>
                            </div>
                            <p className="mt-2 text-pretty text-base leading-7 text-white">
                              {post.text}
                            </p>
                            <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-white/45">
                              {post.characters}/{MAX_POST_LENGTH} characters
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-3">
                  {result.variants.map((variant, index) => (
                    <div
                      key={`post-variant-${index}`}
                      className="flex h-full flex-col rounded-[1rem] border border-panel-border bg-[#171717] p-4 text-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                          Variant {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(variant.post, `post-${index}`)
                          }
                          className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/78 transition hover:border-[#ffb499] hover:text-white"
                        >
                          {copyState === `post-${index}`
                            ? "Copied"
                            : "Copy post"}
                        </button>
                      </div>
                      <p className="mt-2 text-pretty text-lg leading-8 text-white">
                        {variant.post}
                      </p>
                      <p className="mt-auto pt-3 font-mono text-xs uppercase tracking-[0.18em] text-white/45">
                        {variant.characters}/{MAX_POST_LENGTH} characters
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="max-w-sm text-sm leading-7 text-muted">
                Your generated post or thread variants will appear here.
              </p>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border border-[#ffb499]/20 bg-[#ffb499]/10 px-4 py-3 text-sm text-[#9f4b2f]">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
