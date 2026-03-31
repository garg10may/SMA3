"use client";

import { type FormEvent, useState, useTransition } from "react";
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
  markdown: string;
  words: number;
};

type XResponse = PostResult | ThreadResult;
type GenerateResponse = XResponse | MediumResult;

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

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-[1rem] border border-dashed border-panel-border/80 bg-white/40 px-4 py-5">
      <p className="max-w-md text-sm leading-7 text-muted">{copy}</p>
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

        const payload = (await response.json()) as GenerateResponse | { error?: string };

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
  const [includeCode, setIncludeCode] = useState(true);
  const [result, setResult] = useState<MediumResult | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");
  const [isPending, startTransition] = useTransition();

  const briefRemaining = MAX_BRIEF_LENGTH - brief.length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBrief = brief.trim();
    const nextAudience = audience.trim();
    const nextGoal = goal;
    const nextTone = tone;
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
            includeCode: nextIncludeCode,
          }),
        });

        const payload = (await response.json()) as GenerateResponse | { error?: string };

        if (!response.ok || !("format" in payload) || payload.format !== "medium") {
          setResult(null);
          setError(
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "The Medium story could not be generated. Try again.",
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

  async function handleCopy(markdown: string) {
    try {
      await writeClipboard(markdown, renderMediumMarkdown(markdown));
      setCopyState("medium-story");
    } catch {
      setError("Copy failed. You can still select the story manually.");
    }
  }

  const previewHtml = result ? renderMediumMarkdown(result.markdown) : "";

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
              This flow is built for long-form writing. It shapes one complete article for Medium instead of multiple short variants.
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
                  <option className="bg-[#171717]">Tell a story with a takeaway</option>
                  <option className="bg-[#171717]">Make an argument with examples</option>
                  <option className="bg-[#171717]">Break down a workflow</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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

              <label className="inline-flex items-center gap-3 rounded-[0.95rem] border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={includeCode}
                  onChange={(event) => setIncludeCode(event.target.checked)}
                  className="h-4 w-4 accent-[#f6b26b]"
                />
                Include code if relevant
              </label>
            </div>

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
        {result ? (
          <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                    Medium Draft
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                    {result.words} words · rich-text copy enabled
                  </p>
                </div>
                <CopyActionButton
                  copied={copyState === "medium-story"}
                  label="Copy Medium story"
                  onClick={() => handleCopy(result.markdown)}
                />
              </div>

              <div className="mt-4 rounded-[1rem] border border-white/8 bg-[#f8f2e8] p-5 text-[#171717]">
                <div
                  className={[
                    "space-y-4 text-[15px] leading-7",
                    "[&_a]:text-[#a54521] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#d9a16c] [&_blockquote]:pl-4 [&_blockquote]:text-[#5f4b3c]",
                    "[&_code]:rounded [&_code]:bg-[#ead8c2] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-[#3b2d20]",
                    "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] [&_h1]:text-[#171717]",
                    "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em]",
                    "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-[-0.02em]",
                    "[&_li]:mb-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:text-[#2b251f] [&_pre]:overflow-x-auto [&_pre]:rounded-[0.9rem] [&_pre]:border [&_pre]:border-[#dbc7af] [&_pre]:bg-[#f4e7d6] [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-[#2a2018] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#2a2018]",
                    "[&_ul]:ml-5 [&_ul]:list-disc",
                  ].join(" ")}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>

              <p className="mt-3 text-xs leading-6 text-white/52">
                Copy sends both markdown and rich HTML, so pasting into Medium should preserve headings, lists, quotes, and code blocks.
                Stories are capped at about {MAX_MEDIUM_WORDS} words.
              </p>
            </div>
          </div>
        ) : (
          <EmptyState copy="Your Medium story preview will appear here. This side is optimized for one finished draft, not multiple variants." />
        )}

        <ErrorMessage error={error} />
      </section>
    </div>
  );
}

export function PostGenerator() {
  const [platform, setPlatform] = useState<PlatformOption>(DEFAULT_PLATFORM);

  return (
    <div className="space-y-4">
      <section className="rounded-[1.35rem] border border-panel-border bg-panel/80 p-2 shadow-[0_20px_60px_rgba(23,23,23,0.08)]">
        <div className="grid gap-2 sm:grid-cols-2">
          {platformOptions.map((option) => {
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
                <p className={`mt-1 text-sm leading-6 ${active ? "text-white/70" : "text-muted"}`}>
                  {option.helper}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {platform === "x" ? <XComposer /> : <MediumComposer />}
    </div>
  );
}
