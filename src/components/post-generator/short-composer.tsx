"use client";

import type { FormEvent } from "react";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import {
  CopyActionButton,
  EmptyState,
  ErrorMessage,
  FieldLabel,
  StatusPill,
} from "@/components/post-generator/shared";
import type {
  ShortCreateResponse,
  ShortResult,
  ShortStatusResponse,
} from "@/components/post-generator/types";
import { useCopyFeedback } from "@/components/post-generator/use-copy-feedback";
import {
  buildShortCaptionCopy,
  buildShortPackCopy,
  formatShortTimestamp,
  formatUsd,
  readResponsePayload,
  writeClipboard,
} from "@/components/post-generator/utils";
import { logError } from "@/lib/logger";
import {
  DEFAULT_SHORT_DURATION,
  DEFAULT_SHORT_TARGET,
  getShortEstimatedCostUsd,
  shortDurationOptions,
  shortTargetOptions,
  type ShortDurationOption,
  type ShortTargetOption,
} from "@/lib/short-config";
import {
  DEFAULT_TONE,
  MAX_BRIEF_LENGTH,
  toneOptions,
  type ToneOption,
} from "@/lib/post-config";

export function ShortComposer() {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<ToneOption>(DEFAULT_TONE);
  const [target, setTarget] = useState<ShortTargetOption>(DEFAULT_SHORT_TARGET);
  const [duration, setDuration] =
    useState<ShortDurationOption>(DEFAULT_SHORT_DURATION);
  const [result, setResult] = useState<ShortResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { copyState, markCopied, resetCopyState } = useCopyFeedback();

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

      const payload = await readResponsePayload<ShortStatusResponse>(response);

      if (!response.ok || !("format" in payload) || payload.format !== "short") {
        logError("client.short-composer", "Short status refresh failed", {
          status: response.status,
          jobId,
          target: nextTarget,
          requestId: "requestId" in payload ? payload.requestId : undefined,
          payload,
        });
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
    } catch (nextError) {
      logError("client.short-composer", "Short status refresh request failed", {
        jobId,
        target: nextTarget,
        error: nextError,
      });
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
      resetCopyState();
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

        const payload = await readResponsePayload<ShortCreateResponse>(response);

        if (!response.ok || !("format" in payload) || payload.format !== "short") {
          logError("client.short-composer", "Short generation failed", {
            status: response.status,
            target: nextTarget,
            duration: nextDuration,
            tone: nextTone,
            requestId: "requestId" in payload ? payload.requestId : undefined,
            payload,
          });
          setError(
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "The AI short could not be started. Try again.",
          );
          return;
        }

        setResult(payload);
        setError(payload.errorMessage ?? "");
      } catch (nextError) {
        logError("client.short-composer", "Short generation request failed", {
          target: nextTarget,
          duration: nextDuration,
          tone: nextTone,
          error: nextError,
        });
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
