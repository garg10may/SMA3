"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import {
  CopyActionButton,
  ErrorMessage,
  FieldLabel,
  FieldLabelWithInfo,
  MediumIdleState,
  MediumLoadingState,
  RefreshIcon,
} from "@/components/post-generator/shared";
import type {
  GenerateResponse,
  MediumImageResponse,
  MediumImageVersion,
  MediumResult,
} from "@/components/post-generator/types";
import { useCopyFeedback } from "@/components/post-generator/use-copy-feedback";
import {
  buildMediumPreviewHtml,
  createMediumImageVersion,
  readErrorMessage,
  readResponsePayload,
  writeMediumClipboard,
} from "@/components/post-generator/utils";
import { logError } from "@/lib/logger";
import {
  DEFAULT_MEDIUM_IMAGE_STYLE,
  buildMediumLeadImagePrompt,
  getMediumImageStyleLabel,
  mediumImageStyleOptions,
  type MediumImageStyleOption,
} from "@/lib/medium-image";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TONE,
  MAX_BRIEF_LENGTH,
  MAX_MEDIUM_WORDS,
  imageModelOptions,
  imageQualityOptions,
  isImageModelOption,
  isImageQualityOption,
  reasoningEffortOptions,
  textModelOptions,
  toneOptions,
  type ImageModelOption,
  type ImageQualityOption,
  type ReasoningEffortOption,
  type TextModelOption,
  type ToneOption,
} from "@/lib/post-config";

export function MediumComposer() {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("Teach a practical lesson");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [model, setModel] = useState<TextModelOption>(DEFAULT_MODEL);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffortOption>(DEFAULT_REASONING_EFFORT);
  const [imageModel, setImageModel] =
    useState<ImageModelOption>(DEFAULT_IMAGE_MODEL);
  const [imageQuality, setImageQuality] =
    useState<ImageQualityOption>(DEFAULT_IMAGE_QUALITY);
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
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { copyState, markCopied, resetCopyState } = useCopyFeedback();

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
    const nextModel = model;
    const nextReasoningEffort = reasoningEffort;
    const nextImageModel = imageModel;
    const nextImageQuality = imageQuality;
    const nextImageStyle = imageStyle;
    const nextImagePrompt = imagePrompt.trim();
    const nextIncludeCode = includeCode;

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
            platform: "medium",
            brief: nextBrief,
            tone: nextTone,
            model: nextModel,
            reasoningEffort: nextReasoningEffort,
            audience: nextAudience,
            mediumGoal: nextGoal,
            imageModel: nextImageModel,
            imageQuality: nextImageQuality,
            imageStyle: nextImageStyle,
            imagePrompt: nextImagePrompt,
            includeCode: nextIncludeCode,
          }),
        });

        const payload = await readResponsePayload<GenerateResponse>(response);

        if (!response.ok || !("format" in payload) || payload.format !== "medium") {
          logError("client.medium-composer", "Medium generation failed", {
            status: response.status,
            model: nextModel,
            reasoningEffort: nextReasoningEffort,
            requestId: "requestId" in payload ? payload.requestId : undefined,
            payload,
          });
          setResult(null);
          setImageHistory([]);
          setSelectedImageId("");
          setError(
            readErrorMessage(
              payload,
              "The Medium story could not be generated. Try again.",
            ),
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
                  imageModel: payload.imageModel,
                  imageQuality: payload.imageQuality,
                }),
              ]
            : [];
        setImageHistory(nextImageHistory);
        setSelectedImageId(nextImageHistory[0]?.id ?? "");
        setModel(payload.model);
        setReasoningEffort(payload.reasoningEffort);
        setImageModel(payload.imageModel);
        setImageQuality(payload.imageQuality);
        setImageStyle(payload.imageStyle);
        setIsRefreshingImage(false);

        if (!imagePromptEdited) {
          setImagePrompt(payload.imagePrompt);
        }
      } catch (nextError) {
        logError("client.medium-composer", "Medium generation request failed", {
          model: nextModel,
          reasoningEffort: nextReasoningEffort,
          error: nextError,
        });
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
      markCopied("medium-story");
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
          imageModel,
          imageQuality,
          imageStyle,
          imagePrompt: imagePrompt.trim(),
          title: result.title,
          excerpt: result.excerpt,
        }),
      });

      const payload = await readResponsePayload<MediumImageResponse>(response);

      if (
        !response.ok ||
        !("leadImageDataUrl" in payload) ||
        typeof payload.leadImageDataUrl !== "string"
      ) {
        logError("client.medium-composer", "Lead image regeneration failed", {
          status: response.status,
          requestId: "requestId" in payload ? payload.requestId : undefined,
          payload,
        });
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
              imageModel: payload.imageModel,
              imageQuality: payload.imageQuality,
            }
          : current,
      );
      setImageHistory((current) => [nextImage, ...current].slice(0, 6));
      setSelectedImageId(nextImage.id);

      if (!imagePromptEdited) {
        setImagePrompt(payload.imagePrompt);
      }
    } catch (nextError) {
      logError(
        "client.medium-composer",
        "Lead image regeneration request failed",
        {
          resultTitle: result.title,
          imageStyle,
          imageModel,
          imageQuality,
          error: nextError,
        },
      );
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
                <FieldLabelWithInfo
                  htmlFor="medium-model"
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
                  id="medium-model"
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
                <FieldLabelWithInfo
                  htmlFor="medium-reasoning"
                  info={
                    reasoningEffortOptions
                      .map((option) => `${option.label}: ${option.helper}`)
                      .join(" ") +
                    " There is no separate listed surcharge for reasoning levels, but higher effort typically uses more compute and can increase total token usage, latency, and spend."
                  }
                >
                  Reasoning
                </FieldLabelWithInfo>
                <select
                  id="medium-reasoning"
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                <FieldLabelWithInfo
                  htmlFor="medium-image-model"
                  info={imageModelOptions
                    .map(
                      (option) =>
                        `${option.label}: ${option.cost}. ${option.helper}`,
                    )
                    .join(" ")}
                >
                  Image model
                </FieldLabelWithInfo>
                <select
                  id="medium-image-model"
                  value={imageModel}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (isImageModelOption(nextValue)) {
                      setImageModel(nextValue);
                    }
                  }}
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {imageModelOptions.map((option) => (
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
                  htmlFor="medium-image-quality"
                  info={
                    imageQualityOptions
                      .map((option) => `${option.label}: ${option.helper}`)
                      .join(" ") +
                    " Current 1536x1024 pricing depends on both model and quality. GPT Image 1 mini: $0.006 / $0.015 / $0.052 at low / medium / high. GPT Image 1: $0.016 / $0.063 / $0.25. GPT Image 1.5: $0.013 / $0.05 / $0.20."
                  }
                >
                  Image quality
                </FieldLabelWithInfo>
                <select
                  id="medium-image-quality"
                  value={imageQuality}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (isImageQualityOption(nextValue)) {
                      setImageQuality(nextValue);
                    }
                  }}
                  className="w-full rounded-[0.95rem] border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#ffb499]"
                >
                  {imageQualityOptions.map((option) => (
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

            <div className="space-y-2">
              {result ? (
                <button
                  type="button"
                  onClick={handleRefreshImage}
                  disabled={isPending || isRefreshingImage || brief.trim().length < 12}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white transition hover:border-[#ffb499] hover:text-[#fff3ec] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span
                    className={isRefreshingImage ? "animate-spin" : undefined}
                  >
                    <RefreshIcon />
                  </span>
                  {isRefreshingImage
                    ? "Refreshing image..."
                    : "Refresh lead image"}
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isPending || brief.trim().length < 12}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#f6b26b] px-5 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#ffc58f] disabled:cursor-not-allowed disabled:bg-[#c79d6b]"
              >
                {isPending ? "Writing..." : "Generate Medium story"}
              </button>

              {result ? (
                <p className="text-xs leading-6 text-white/45">
                  Update the image model, quality, type, or prompt above, then
                  refresh the lead image without regenerating the full story.
                </p>
              ) : null}
            </div>
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
