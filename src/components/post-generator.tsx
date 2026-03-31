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
} from "@/lib/post-config";

type PostResult = {
  format: "post";
  post: string;
  characters: number;
};

type ThreadResult = {
  format: "thread";
  posts: Array<{
    text: string;
    characters: number;
  }>;
};

type GenerateResponse = PostResult | ThreadResult;

export function PostGenerator() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [format, setFormat] = useState<FormatOption>(DEFAULT_FORMAT);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isPending, startTransition] = useTransition();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;

  function handleSubmit(formData: FormData) {
    const nextBrief = String(formData.get("brief") ?? "").trim();
    const nextTone = String(formData.get("tone") ?? DEFAULT_TONE) as ToneOption;
    const rawFormat = String(formData.get("format") ?? DEFAULT_FORMAT);
    const nextFormat = isFormatOption(rawFormat) ? rawFormat : DEFAULT_FORMAT;

    startTransition(async () => {
      setError("");
      setCopyState("idle");

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

  async function handleCopy() {
    if (!result) {
      return;
    }

    try {
      const text =
        result.format === "thread"
          ? result.posts
              .map((post, index) => `${index + 1}/${result.posts.length}\n${post.text}`)
              .join("\n\n")
          : result.post;
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setError("Copy failed. You can still select the text manually.");
    }
  }

  return (
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
            <label className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">
              Output type
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {formatOptions.map((option) => {
                const active = format === option.value;

                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-[1.15rem] border px-4 py-3 transition ${
                      active
                        ? "border-[#ffb499] bg-[#ffb499]/12"
                        : "border-white/12 bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={option.value}
                      checked={active}
                      onChange={(event) =>
                        setFormat(event.target.value as FormatOption)
                      }
                      className="sr-only"
                    />
                    <p className="text-sm font-medium text-white">{option.label}</p>
                    <p className="mt-1 text-xs leading-6 text-white/55">
                      {option.helper}
                    </p>
                  </label>
                );
              })}
            </div>
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
                ? "Generate thread"
                : "Generate post"}
          </button>
        </form>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffb499]">
                Output
              </p>
              <p className="mt-1 text-sm text-white/55">
                {result?.format === "thread"
                  ? `Each post is trimmed to stay within ${MAX_POST_LENGTH} characters.`
                  : `The result is trimmed to stay within ${MAX_POST_LENGTH} characters.`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!result}
              className="rounded-full border border-white/14 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white/78 transition hover:border-[#ffb499] hover:text-white disabled:cursor-not-allowed disabled:border-white/8 disabled:text-white/30"
            >
              {copyState === "copied" ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 min-h-44 rounded-[1.2rem] border border-dashed border-white/10 bg-white/[0.03] p-4">
            {result ? (
              result.format === "thread" ? (
                <div className="space-y-4">
                  {result.posts.map((post, index) => (
                    <div
                      key={`${index}-${post.text.slice(0, 24)}`}
                      className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4"
                    >
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                        {index + 1}/{result.posts.length}
                      </p>
                      <p className="mt-2 text-pretty text-base leading-7 text-white">
                        {post.text}
                      </p>
                      <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-white/45">
                        {post.characters}/{MAX_POST_LENGTH} characters
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-pretty text-lg leading-8 text-white">
                    {result.post}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">
                    {result.characters}/{MAX_POST_LENGTH} characters
                  </p>
                </div>
              )
            ) : (
              <p className="max-w-sm text-sm leading-7 text-white/40">
                Your generated post or thread will appear here.
              </p>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border border-[#ffb499]/20 bg-[#ffb499]/10 px-4 py-3 text-sm text-[#ffd8c1]">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
