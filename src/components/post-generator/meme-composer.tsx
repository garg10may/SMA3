"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import {
  CopyActionButton,
  EmptyState,
  ErrorMessage,
  FieldLabel,
  FieldLabelWithInfo,
} from "@/components/post-generator/shared";
import type {
  MemeResponse,
  MemeResult,
  MemeTemplatesResponse,
} from "@/components/post-generator/types";
import { useCopyFeedback } from "@/components/post-generator/use-copy-feedback";
import {
  readErrorMessage,
  readResponsePayload,
  writeClipboard,
} from "@/components/post-generator/utils";
import { logError } from "@/lib/logger";
import type { MemeTemplate } from "@/lib/meme-agent";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TONE,
  MAX_BRIEF_LENGTH,
  reasoningEffortOptions,
  textModelOptions,
  toneOptions,
  type ReasoningEffortOption,
  type TextModelOption,
  type ToneOption,
} from "@/lib/post-config";

export function MemeComposer() {
  const [content, setContent] = useState("");
  const [direction, setDirection] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [model, setModel] = useState<TextModelOption>(DEFAULT_MODEL);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffortOption>(DEFAULT_REASONING_EFFORT);
  const [templateId, setTemplateId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [usingFallbackTemplates, setUsingFallbackTemplates] = useState(false);
  const [result, setResult] = useState<MemeResult | null>(null);
  const [error, setError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { copyState, markCopied, resetCopyState } = useCopyFeedback();

  const contentRemaining = MAX_BRIEF_LENGTH - content.length;
  const selectedTemplate =
    (result ? templates.find((template) => template.id === result.template.id) : null) ??
    templates.find((template) => template.id === templateId) ??
    null;
  const filteredTemplates = templates.filter((template) => {
    const query = templateSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    const haystack = [
      template.id,
      template.name,
      template.keywords.join(" "),
      template.source ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const response = await fetch("/api/meme-templates", {
          cache: "no-store",
        });
        const payload = await readResponsePayload<MemeTemplatesResponse>(response);

        if (
          !response.ok ||
          !("templates" in payload) ||
          !Array.isArray(payload.templates)
        ) {
          if (!cancelled) {
            setTemplateError("The live memegen template catalog could not be loaded.");
          }
          return;
        }

        if (!cancelled) {
          setTemplates(payload.templates);
          setUsingFallbackTemplates(payload.usingFallback);
          setTemplateError("");
        }
      } catch {
        if (!cancelled) {
          setTemplateError("The live memegen template catalog could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setTemplatesLoaded(true);
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextContent = content.trim();
    const nextDirection = direction.trim();
    const nextTone = tone;
    const nextModel = model;
    const nextReasoningEffort = reasoningEffort;
    const nextTemplateId = templateId;

    startTransition(async () => {
      setError("");
      resetCopyState();

      try {
        const response = await fetch("/api/generate-meme", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: nextContent,
            direction: nextDirection,
            tone: nextTone,
            model: nextModel,
            reasoningEffort: nextReasoningEffort,
            templateId: nextTemplateId || undefined,
          }),
        });

        const payload = await readResponsePayload<MemeResponse>(response);

        if (!response.ok || !("format" in payload) || payload.format !== "meme") {
          logError("client.meme-composer", "Meme generation failed", {
            status: response.status,
            tone: nextTone,
            model: nextModel,
            reasoningEffort: nextReasoningEffort,
            templateId: nextTemplateId || undefined,
            requestId: "requestId" in payload ? payload.requestId : undefined,
            payload,
          });
          setResult(null);
          setError(readErrorMessage(payload, "The meme could not be generated. Try again."));
          return;
        }

        setResult(payload);
      } catch (nextError) {
        logError("client.meme-composer", "Meme generation request failed", {
          tone: nextTone,
          model: nextModel,
          reasoningEffort: nextReasoningEffort,
          templateId: nextTemplateId || undefined,
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

  const lineCopy = result?.lines.filter(Boolean).join("\n") ?? "";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffb499]">
              Meme Agent
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Generate a memegen reply
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/68">
              This agent chooses a template from a curated memegen set, writes
              the caption, and returns a ready-to-preview meme URL.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="meme-content">Tweet or reply context</FieldLabel>
              <textarea
                id="meme-content"
                rows={8}
                maxLength={MAX_BRIEF_LENGTH}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Example: Founder says they replaced strategy with ten dashboards and now wonders why nobody knows what matters."
                className="w-full resize-none rounded-[1.15rem] border border-white/12 bg-white/[0.06] px-3.5 py-3.5 text-base leading-7 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
                required
              />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>Paste the post or explain the moment you want to react to.</span>
                <span>{contentRemaining} left</span>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="meme-direction">Optional direction</FieldLabel>
              <textarea
                id="meme-direction"
                rows={4}
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
                placeholder="Example: Make it mildly mocking, not hostile. Focus on operator chaos."
                className="w-full resize-none rounded-[1.05rem] border border-white/12 bg-white/[0.06] px-3.5 py-3 text-sm leading-6 text-white outline-none transition focus:border-[#ffb499] focus:bg-white/[0.08]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="meme-tone">Tone</FieldLabel>
                <select
                  id="meme-tone"
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
                <FieldLabelWithInfo
                  htmlFor="meme-model"
                  info={textModelOptions
                    .map(
                      (option) =>
                        `${option.label}: ${option.cost}. ${option.helper}`,
                    )
                    .join(" ")}
                >
                  Writing model
                </FieldLabelWithInfo>
                <select
                  id="meme-model"
                  value={model}
                  onChange={(event) =>
                    setModel(event.target.value as TextModelOption)
                  }
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {textModelOptions.map((option) => (
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabelWithInfo
                  htmlFor="meme-reasoning"
                  info={reasoningEffortOptions
                    .map((option) => `${option.label}: ${option.helper}`)
                    .join(" ")}
                >
                  Reasoning
                </FieldLabelWithInfo>
                <select
                  id="meme-reasoning"
                  value={reasoningEffort}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (
                      reasoningEffortOptions.some(
                        (option) => option.value === nextValue,
                      )
                    ) {
                      setReasoningEffort(nextValue as ReasoningEffortOption);
                    }
                  }}
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {reasoningEffortOptions.map((option) => (
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
                <FieldLabel htmlFor="meme-template">Template</FieldLabel>
                <select
                  id="meme-template"
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  <option value="" className="bg-[#171717]">
                    Auto choose
                  </option>
                  {filteredTemplates.map((template) => (
                    <option
                      key={template.id}
                      value={template.id}
                      className="bg-[#171717]"
                    >
                      {template.name}
                    </option>
                  ))}
                </select>
                <input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Search 200+ live templates"
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                />
                <p className="text-xs leading-6 text-white/45">
                  {templateId
                    ? selectedTemplate
                      ? `${selectedTemplate.lines} line${selectedTemplate.lines === 1 ? "" : "s"} · ${selectedTemplate.keywords.slice(0, 4).join(", ") || "no keywords"}`
                      : "Selected template"
                    : templatesLoaded
                      ? `Leave this on auto to let the agent choose from the live memegen catalog (${templates.length} templates loaded${usingFallbackTemplates ? ", fallback set" : ""}).`
                      : "Loading live memegen templates..."}
                </p>
                {templateError ? (
                  <p className="text-xs leading-6 text-[#ffcfbc]">{templateError}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1rem] border border-[#f6b26b]/20 bg-[#f6b26b]/8 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffd7ad]">
                Memegen-backed render
              </p>
              <p className="mt-2 text-sm leading-7 text-white/74">
                The agent only writes the caption and chooses the template.
                Rendering happens through memegen so you can evaluate real meme
                formats instead of synthetic AI image art.
              </p>
            </div>

            <button
              type="submit"
              disabled={isPending || content.trim().length < 12}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
            >
              {isPending ? "Generating meme..." : "Generate meme"}
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
                    Generated Meme
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                    {result.template.name} · {result.template.lineCount} line
                    {result.template.lineCount > 1 ? "s" : ""} · {result.model} ·{" "}
                    {result.reasoningEffort}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={result.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                  >
                    Open image
                  </a>
                  <a
                    href={result.imageUrl}
                    download={`${result.template.id}.jpg`}
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                  >
                    Download
                  </a>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[1rem] border border-white/8 bg-white">
                <Image
                  src={result.imageUrl}
                  alt={result.title}
                  width={1200}
                  height={1200}
                  unoptimized
                  className="w-full"
                />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                      Caption lines
                    </p>
                    <CopyActionButton
                      copied={copyState === "meme-lines"}
                      label="Copy meme lines"
                      onClick={() => handleCopy(lineCopy, "meme-lines")}
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {result.lines.map((line, index) => (
                      <div
                        key={`${result.template.id}-line-${index}`}
                        className="rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2.5"
                      >
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                          Line {index + 1}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/80">
                          {line || "Blank"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                      Agent choice
                    </p>
                    <CopyActionButton
                      copied={copyState === "meme-rationale"}
                      label="Copy meme rationale"
                      onClick={() =>
                        handleCopy(
                          `${result.template.name}\n\n${result.rationale}`,
                          "meme-rationale",
                        )
                      }
                    />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">
                    {result.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-white/78">
                    {result.rationale}
                  </p>
                  {selectedTemplate ? (
                    <div className="mt-4 rounded-[0.95rem] border border-white/8 bg-black/20 px-3.5 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                        Template fit
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/72">
                        {selectedTemplate.lines} line
                        {selectedTemplate.lines === 1 ? "" : "s"} ·{" "}
                        {selectedTemplate.keywords.slice(0, 6).join(", ") ||
                          "No keyword metadata"}
                      </p>
                    </div>
                  ) : null}
                  <a
                    href={result.blankUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                  >
                    View blank template
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState copy="Your memegen preview will appear here with the chosen template, caption lines, and direct image link." />
        )}

        <ErrorMessage error={error} />
      </section>
    </div>
  );
}
