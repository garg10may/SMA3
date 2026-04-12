"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import {
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
} from "react";
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
  ReactionCatalogResponse,
  ReactionResponse,
  ReactionResult,
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

type MemeMode = "template" | "reaction";

export function MemeComposer() {
  const [mode, setMode] = useState<MemeMode>("template");
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
  const [templateResult, setTemplateResult] = useState<MemeResult | null>(null);
  const [reactionResult, setReactionResult] = useState<ReactionResult | null>(null);
  const [reactionSearch, setReactionSearch] = useState("");
  const deferredReactionSearch = useDeferredValue(reactionSearch.trim());
  const [reactionCatalog, setReactionCatalog] = useState<
    ReactionCatalogResponse["items"]
  >([]);
  const [reactionCatalogTotal, setReactionCatalogTotal] = useState(0);
  const [reactionCatalogLoaded, setReactionCatalogLoaded] = useState(false);
  const [reactionCatalogFallback, setReactionCatalogFallback] = useState(false);
  const [reactionCatalogError, setReactionCatalogError] = useState("");
  const [error, setError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { copyState, markCopied, resetCopyState } = useCopyFeedback();

  const contentRemaining = MAX_BRIEF_LENGTH - content.length;
  const activeTemplateVariant =
    (templateResult && templateResult.variants[activeVariantIndex]) ||
    templateResult?.variants[0] ||
    null;
  const activeReactionVariant =
    (reactionResult && reactionResult.variants[activeVariantIndex]) ||
    reactionResult?.variants[0] ||
    null;
  const selectedTemplate =
    (activeTemplateVariant
      ? templates.find((template) => template.id === activeTemplateVariant.template.id)
      : null) ??
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

  useEffect(() => {
    let cancelled = false;

    async function loadReactionCatalog() {
      try {
        const params = new URLSearchParams({
          limit: deferredReactionSearch ? "9" : "6",
        });

        if (deferredReactionSearch) {
          params.set("q", deferredReactionSearch);
        }

        const response = await fetch(`/api/reaction-catalog?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await readResponsePayload<ReactionCatalogResponse>(response);

        if (!response.ok || !("items" in payload) || !Array.isArray(payload.items)) {
          if (!cancelled) {
            setReactionCatalogError("The reaction catalog could not be loaded.");
          }
          return;
        }

        if (!cancelled) {
          setReactionCatalog(payload.items);
          setReactionCatalogTotal(payload.total);
          setReactionCatalogFallback(payload.fallback);
          setReactionCatalogError("");
        }
      } catch {
        if (!cancelled) {
          setReactionCatalogError("The reaction catalog could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setReactionCatalogLoaded(true);
        }
      }
    }

    void loadReactionCatalog();

    return () => {
      cancelled = true;
    };
  }, [deferredReactionSearch]);

  useEffect(() => {
    setActiveVariantIndex(0);
    setError("");
    resetCopyState();
  }, [mode, resetCopyState]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextContent = content.trim();
    const nextDirection = direction.trim();
    const nextTone = tone;
    const nextModel = model;
    const nextReasoningEffort = reasoningEffort;
    const nextTemplateId = templateId;
    const isTemplateMode = mode === "template";

    startTransition(async () => {
      setError("");
      resetCopyState();

      try {
        const response = await fetch(
          isTemplateMode ? "/api/generate-meme" : "/api/generate-reaction-meme",
          {
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
              templateId: isTemplateMode ? nextTemplateId || undefined : undefined,
            }),
          },
        );

        if (isTemplateMode) {
          const payload = await readResponsePayload<MemeResponse>(response);

          if (!response.ok || !("format" in payload) || payload.format !== "meme") {
            logError("client.meme-composer", "Template meme generation failed", {
              status: response.status,
              tone: nextTone,
              model: nextModel,
              reasoningEffort: nextReasoningEffort,
              templateId: nextTemplateId || undefined,
              requestId: "requestId" in payload ? payload.requestId : undefined,
              payload,
            });
            setTemplateResult(null);
            setError(
              readErrorMessage(payload, "The meme could not be generated. Try again."),
            );
            return;
          }

          setTemplateResult(payload);
          setActiveVariantIndex(0);
          return;
        }

        const payload = await readResponsePayload<ReactionResponse>(response);

        if (!response.ok || !("format" in payload) || payload.format !== "reaction") {
          logError("client.meme-composer", "Reaction meme generation failed", {
            status: response.status,
            tone: nextTone,
            model: nextModel,
            reasoningEffort: nextReasoningEffort,
            requestId: "requestId" in payload ? payload.requestId : undefined,
            payload,
          });
          setReactionResult(null);
          setError(
            readErrorMessage(
              payload,
              "The reaction meme could not be generated. Try again.",
            ),
          );
          return;
        }

        setReactionResult(payload);
        setActiveVariantIndex(0);
      } catch (nextError) {
        logError("client.meme-composer", "Meme generation request failed", {
          mode,
          tone: nextTone,
          model: nextModel,
          reasoningEffort: nextReasoningEffort,
          templateId: isTemplateMode ? nextTemplateId || undefined : undefined,
          error: nextError,
        });

        if (isTemplateMode) {
          setTemplateResult(null);
        } else {
          setReactionResult(null);
        }

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

  const templateLineCopy =
    activeTemplateVariant?.lines.filter(Boolean).join("\n") ?? "";
  const reactionCaptionCopy = activeReactionVariant?.caption ?? "";
  const reactionCatalogBlurb = reactionCatalogLoaded
    ? deferredReactionSearch
      ? reactionCatalogFallback
        ? `No strong search hit. Showing the best local reaction images from the ${reactionCatalogTotal}-image catalog.`
        : `Showing ${reactionCatalog.length} local matches from the ${reactionCatalogTotal}-image reaction catalog.`
      : `The planner reasons over a local reaction catalog with ${reactionCatalogTotal} famous image macros.`
    : "Loading the local reaction catalog...";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.18)] sm:p-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffb499]">
              Meme Agent
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Generate meme options
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/68">
              {mode === "template"
                ? "This agent picks three different memegen templates, writes the caption for each, and returns ready-to-preview meme URLs."
                : "This agent picks three reaction images from the local catalog, writes a top caption for each, and renders ready-to-share reaction memes."}
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: "template" as const,
                label: "Template Memes",
                helper: "Classic memegen formats like Drake, Gru, and Change My Mind.",
              },
              {
                value: "reaction" as const,
                label: "Reaction Memes",
                helper: "Top-caption reaction images where the face does the emotional work.",
              },
            ].map((option) => {
              const active = mode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-[1rem] border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#ffb499] bg-[#ffb499]/12"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffb499]">
                    {option.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {option.helper}
                  </p>
                </button>
              );
            })}
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
                placeholder={
                  mode === "template"
                    ? "Example: Make it mildly mocking, not hostile. Focus on operator chaos."
                    : "Example: I want a deadpan professional reaction, not open panic."
                }
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
                      (option) => `${option.label}: ${option.cost}. ${option.helper}`,
                    )
                    .join(" ")}
                >
                  Writing model
                </FieldLabelWithInfo>
                <select
                  id="meme-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value as TextModelOption)}
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

              {mode === "template" ? (
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
              ) : (
                <div className="space-y-2">
                  <FieldLabel htmlFor="reaction-search">Reaction Catalog</FieldLabel>
                  <input
                    id="reaction-search"
                    value={reactionSearch}
                    onChange={(event) => setReactionSearch(event.target.value)}
                    placeholder="Search by vibe, situation, or emotion"
                    className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                  />
                  <p className="text-xs leading-6 text-white/45">
                    {reactionCatalogBlurb}
                  </p>
                  {reactionCatalogError ? (
                    <p className="text-xs leading-6 text-[#ffcfbc]">
                      {reactionCatalogError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {mode === "reaction" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {reactionCatalog.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-[1rem] border border-white/10 bg-white/[0.03]"
                  >
                    <div className="aspect-[4/4.8] bg-white">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={600}
                        height={700}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1 px-3.5 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffb499]">
                        {item.intensity} intensity
                      </p>
                      <p className="text-sm font-semibold tracking-[-0.02em] text-white">
                        {item.name}
                      </p>
                      <p className="text-xs leading-5 text-white/58">{item.helper}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-[1rem] border border-[#f6b26b]/20 bg-[#f6b26b]/8 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffd7ad]">
                {mode === "template" ? "Memegen-backed render" : "Reaction card render"}
              </p>
              <p className="mt-2 text-sm leading-7 text-white/74">
                {mode === "template"
                  ? "The agent now returns three different meme takes so you can compare template fit and punchline quality before picking one."
                  : "The agent now returns three different reaction images with top-caption copy so the emotion comes from the photo, not from text boxes inside the image."}
              </p>
            </div>

            <button
              type="submit"
              disabled={isPending || content.trim().length < 12}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
            >
              {isPending
                ? mode === "template"
                  ? "Generating meme options..."
                  : "Generating reaction memes..."
                : mode === "template"
                  ? "Generate 3 meme options"
                  : "Generate 3 reaction memes"}
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        {mode === "template" ? (
          templateResult && activeTemplateVariant ? (
            <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                {templateResult.variants.length > 1 ? (
                  <div className="mb-4 grid gap-2 sm:grid-cols-3">
                    {templateResult.variants.map((variant, index) => {
                      const isActive = variant === activeTemplateVariant;

                      return (
                        <button
                          key={`${variant.template.id}-${index}`}
                          type="button"
                          onClick={() => setActiveVariantIndex(index)}
                          className={`rounded-[1rem] border px-3.5 py-3 text-left transition ${
                            isActive
                              ? "border-[#ffb499] bg-[#ffb499]/12"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                          }`}
                        >
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffb499]">
                            Option {index + 1}
                          </p>
                          <p className="mt-2 text-sm font-semibold tracking-[-0.02em] text-white">
                            {variant.template.name}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-white/55">
                            {variant.title}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                      {templateResult.variants.length > 1
                        ? "Generated Memes"
                        : "Generated Meme"}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                      {activeTemplateVariant.template.name} ·{" "}
                      {activeTemplateVariant.template.lineCount} line
                      {activeTemplateVariant.template.lineCount > 1 ? "s" : ""} ·{" "}
                      {templateResult.model} · {templateResult.reasoningEffort}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={activeTemplateVariant.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                    >
                      Open image
                    </a>
                    <a
                      href={activeTemplateVariant.imageUrl}
                      download={`${activeTemplateVariant.template.id}.jpg`}
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                    >
                      Download
                    </a>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[1rem] border border-white/8 bg-white">
                  <Image
                    src={activeTemplateVariant.imageUrl}
                    alt={activeTemplateVariant.title}
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
                        onClick={() => handleCopy(templateLineCopy, "meme-lines")}
                      />
                    </div>
                    <div className="mt-3 space-y-2">
                      {activeTemplateVariant.lines.map((line, index) => (
                        <div
                          key={`${activeTemplateVariant.template.id}-line-${index}`}
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
                            `${activeTemplateVariant.template.name}\n\n${activeTemplateVariant.rationale}`,
                            "meme-rationale",
                          )
                        }
                      />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">
                      {activeTemplateVariant.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-white/78">
                      {activeTemplateVariant.rationale}
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
                      href={activeTemplateVariant.blankUrl}
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
            <EmptyState copy="Your meme options will appear here with three template picks, caption lines, and direct image links." />
          )
        ) : reactionResult && activeReactionVariant ? (
          <div className="rounded-[1.6rem] border border-panel-border bg-[#171717] p-3 text-white shadow-[0_24px_80px_rgba(23,23,23,0.14)] sm:p-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              {reactionResult.variants.length > 1 ? (
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  {reactionResult.variants.map((variant, index) => {
                    const isActive = variant === activeReactionVariant;

                    return (
                      <button
                        key={`${variant.reaction.id}-${index}`}
                        type="button"
                        onClick={() => setActiveVariantIndex(index)}
                        className={`rounded-[1rem] border px-3.5 py-3 text-left transition ${
                          isActive
                            ? "border-[#ffb499] bg-[#ffb499]/12"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ffb499]">
                          Option {index + 1}
                        </p>
                        <p className="mt-2 text-sm font-semibold tracking-[-0.02em] text-white">
                          {variant.reaction.name}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/55">
                          {variant.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#ffb499]">
                    Generated Reaction Memes
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
                    {activeReactionVariant.reaction.name} ·{" "}
                    {activeReactionVariant.reaction.intensity} intensity ·{" "}
                    {reactionResult.model} · {reactionResult.reasoningEffort}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={activeReactionVariant.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                  >
                    Open image
                  </a>
                  <a
                    href={activeReactionVariant.imageUrl}
                    download={`${activeReactionVariant.reaction.id}.png`}
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                  >
                    Download
                  </a>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[1rem] border border-white/8 bg-white">
                <Image
                  src={activeReactionVariant.imageUrl}
                  alt={activeReactionVariant.title}
                  width={1080}
                  height={1350}
                  unoptimized
                  className="w-full"
                />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                      Top caption
                    </p>
                    <CopyActionButton
                      copied={copyState === "reaction-caption"}
                      label="Copy reaction caption"
                      onClick={() =>
                        handleCopy(reactionCaptionCopy, "reaction-caption")
                      }
                    />
                  </div>
                  <div className="mt-3 rounded-[0.9rem] border border-white/8 bg-black/20 px-4 py-4">
                    <p className="text-xl font-semibold tracking-[-0.03em] text-white">
                      {activeReactionVariant.caption}
                    </p>
                  </div>
                  <div className="mt-4 rounded-[0.95rem] border border-white/8 bg-black/20 px-3.5 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                      Why this format works
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/72">
                      Top-caption reaction memes work when the image carries the
                      emotional payload and the caption just frames the moment.
                    </p>
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ffb499]">
                      Agent choice
                    </p>
                    <CopyActionButton
                      copied={copyState === "reaction-rationale"}
                      label="Copy reaction rationale"
                      onClick={() =>
                        handleCopy(
                          `${activeReactionVariant.reaction.name}\n\n${activeReactionVariant.rationale}`,
                          "reaction-rationale",
                        )
                      }
                    />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">
                    {activeReactionVariant.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-white/78">
                    {activeReactionVariant.rationale}
                  </p>
                  <div className="mt-4 rounded-[0.95rem] border border-white/8 bg-black/20 px-3.5 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                      Emotional tags
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/72">
                      {activeReactionVariant.reaction.emotionTags.join(", ")}
                    </p>
                  </div>
                  <div className="mt-3 rounded-[0.95rem] border border-white/8 bg-black/20 px-3.5 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                      Situation tags
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/72">
                      {activeReactionVariant.reaction.situationTags.join(", ")}
                    </p>
                  </div>
                  <a
                    href={activeReactionVariant.sourceImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 transition hover:border-[#ffb499] hover:text-white"
                  >
                    View source image
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState copy="Your reaction meme options will appear here with three image picks, top captions, and direct render links." />
        )}

        <ErrorMessage error={error} />
      </section>
    </div>
  );
}
