"use client";

import { type FormEvent, useState, useTransition } from "react";
import {
  DEFAULT_FORMAT,
  DEFAULT_TONE,
  formatOptions,
  type FormatOption,
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

type CopyActionButtonProps = {
  copied: boolean;
  label: string;
  onClick: () => void;
};

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

export function PostGenerator() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [format, setFormat] = useState<FormatOption>(DEFAULT_FORMAT);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<string>("");
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
    <div className="space-y-4">
      <section className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
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

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                className="w-full resize-none rounded-[1.15rem] border border-white/12 bg-white/[0.06] px-3.5 py-3.5 text-base leading-7 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
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
                        className={`rounded-[1rem] border px-3.5 py-2.5 transition ${
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
          <div className="rounded-[1rem] border border-dashed border-panel-border/80 bg-white/40 px-4 py-5">
            <p className="max-w-sm text-sm leading-7 text-muted">
              Your generated post or thread variants will appear here.
            </p>
          </div>
        )}

        {error ? (
          <p className="rounded-2xl border border-[#ffb499]/20 bg-[#ffb499]/10 px-4 py-3 text-sm text-[#9f4b2f]">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
