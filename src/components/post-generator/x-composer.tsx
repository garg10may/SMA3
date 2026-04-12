"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import {
  CopyActionButton,
  EmptyState,
  ErrorMessage,
  FieldLabel,
} from "@/components/post-generator/shared";
import type {
  GenerateResponse,
  XResponse,
} from "@/components/post-generator/types";
import { useCopyFeedback } from "@/components/post-generator/use-copy-feedback";
import {
  readErrorMessage,
  readResponsePayload,
  writeClipboard,
} from "@/components/post-generator/utils";
import { logError } from "@/lib/logger";
import {
  DEFAULT_FORMAT,
  DEFAULT_TONE,
  MAX_BRIEF_LENGTH,
  MAX_POST_LENGTH,
  VARIANT_COUNT,
  formatOptions,
  toneOptions,
  type FormatOption,
  type ToneOption,
} from "@/lib/post-config";

export function XComposer() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [format, setFormat] = useState<FormatOption>(DEFAULT_FORMAT);
  const [result, setResult] = useState<XResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { copyState, markCopied, resetCopyState } = useCopyFeedback();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBrief = brief.trim();
    const nextTone = tone;
    const nextFormat = format;

    startTransition(async () => {
      setError("");
      resetCopyState();

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

        const payload = await readResponsePayload<GenerateResponse>(response);

        if (
          !response.ok ||
          !("format" in payload) ||
          (payload.format !== "post" && payload.format !== "thread")
        ) {
          logError("client.x-composer", "X generation failed", {
            status: response.status,
            format: nextFormat,
            tone: nextTone,
            requestId: "requestId" in payload ? payload.requestId : undefined,
            payload,
          });
          setResult(null);
          setError(
            readErrorMessage(
              payload,
              "The X draft could not be generated. Try again.",
            ),
          );
          return;
        }

        setResult(payload);
      } catch (nextError) {
        logError("client.x-composer", "X generation request failed", {
          format: nextFormat,
          tone: nextTone,
          error: nextError,
        });
        setResult(null);
        setError("The request failed. Check your connection and try again.");
      }
    });
  }

  async function handleCopy(text: string, key: string) {
    try {
      await writeClipboard(text);
      markCopied(key);
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
