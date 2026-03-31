export const DEFAULT_SHORT_MODEL = "sora-2";
export const DEFAULT_SHORT_SIZE = "720x1280";
export const SHORT_COST_PER_SECOND_USD = 0.1;

export const shortDurationOptions = [
  {
    value: "4",
    label: "4 seconds",
    helper: "Lowest-cost test render for quick prompt checks.",
  },
  {
    value: "8",
    label: "8 seconds",
    helper: "Best default for social shorts without wasting spend.",
  },
  {
    value: "12",
    label: "12 seconds",
    helper: "More room for a mini story, with higher render cost.",
  },
] as const;

export const shortTargetOptions = [
  {
    value: "youtube",
    label: "YouTube Shorts",
    helper: "Optimized for title, caption, and hook-driven short uploads.",
  },
  {
    value: "instagram",
    label: "Instagram Reels",
    helper: "Leans a little more visual and punchy for Reels.",
  },
  {
    value: "tiktok",
    label: "TikTok",
    helper: "Slightly more casual packaging for TikTok-style posting.",
  },
] as const;

export type ShortDurationOption = (typeof shortDurationOptions)[number]["value"];
export type ShortTargetOption = (typeof shortTargetOptions)[number]["value"];

export const DEFAULT_SHORT_DURATION: ShortDurationOption =
  shortDurationOptions[1].value;
export const DEFAULT_SHORT_TARGET: ShortTargetOption =
  shortTargetOptions[0].value;

export function isShortDurationOption(
  value: string,
): value is ShortDurationOption {
  return shortDurationOptions.some((option) => option.value === value);
}

export function isShortTargetOption(value: string): value is ShortTargetOption {
  return shortTargetOptions.some((option) => option.value === value);
}

export function getShortTargetLabel(value: ShortTargetOption) {
  return (
    shortTargetOptions.find((option) => option.value === value)?.label ??
    shortTargetOptions[0].label
  );
}

export function getShortEstimatedCostUsd(
  value: ShortDurationOption | string,
) {
  const seconds = Number(value);

  return Number.isFinite(seconds)
    ? Number((seconds * SHORT_COST_PER_SECOND_USD).toFixed(2))
    : 0;
}
