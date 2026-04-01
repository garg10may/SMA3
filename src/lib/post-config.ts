export const MAX_BRIEF_LENGTH = 600;
export const MAX_POST_LENGTH = 280;
export const MAX_MEDIUM_WORDS = 1400;
export const DEFAULT_MODEL = "gpt-5.4-mini";
export const DEFAULT_IMAGE_MODEL = "gpt-image-1-mini";
export const MAX_THREAD_POSTS = 5;
export const DEFAULT_THREAD_POSTS = 4;
export const VARIANT_COUNT = 3;

export const textModelOptions = [
  {
    value: "gpt-5.4",
    label: "GPT-5.4",
    helper: "Best output quality in this picker.",
    cost: "$2.50 input / $15 output per 1M tokens",
  },
  {
    value: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    helper: "Best balance of quality, speed, and cost.",
    cost: "$0.75 input / $4.50 output per 1M tokens",
  },
  {
    value: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    helper: "Cheapest 5.4-family option for lighter drafts.",
    cost: "$0.20 input / $1.25 output per 1M tokens",
  },
] as const;

export const imageModelOptions = [
  {
    value: "gpt-image-1-mini",
    label: "GPT Image 1 mini",
    helper: "Lowest-cost option for fast lead-image iteration.",
    cost: "$0.006 / $0.015 / $0.052 per 1536x1024 image at low / medium / high",
  },
  {
    value: "gpt-image-1",
    label: "GPT Image 1",
    helper: "Balanced quality and cost for editorial images.",
    cost: "$0.016 / $0.063 / $0.25 per 1536x1024 image at low / medium / high",
  },
  {
    value: "gpt-image-1.5",
    label: "GPT Image 1.5",
    helper: "Highest-quality option in this picker, with higher cost.",
    cost: "$0.013 / $0.05 / $0.20 per 1536x1024 image at low / medium / high",
  },
] as const;

export const reasoningEffortOptions = [
  {
    value: "none",
    label: "None",
    helper: "Fastest, with the least extra thinking.",
  },
  {
    value: "low",
    label: "Low",
    helper: "Faster responses with some extra reasoning.",
  },
  {
    value: "medium",
    label: "Medium",
    helper: "Sensible default for strong writing quality.",
  },
  {
    value: "high",
    label: "High",
    helper: "More deliberate reasoning for harder prompts.",
  },
  {
    value: "xhigh",
    label: "X-High",
    helper: "Most thinking, highest latency.",
  },
] as const;

export const imageQualityOptions = [
  {
    value: "low",
    label: "Low",
    helper: "Cheapest image generation setting.",
  },
  {
    value: "medium",
    label: "Medium",
    helper: "Best default balance for Medium lead images.",
  },
  {
    value: "high",
    label: "High",
    helper: "Best detail, most expensive image setting.",
  },
] as const;

export const platformOptions = [
  {
    value: "x",
    label: "X",
    helper: "Generate short-form posts and threads for X.",
  },
  {
    value: "medium",
    label: "Medium",
    helper: "Generate one Medium-ready story you can paste directly into the editor.",
  },
] as const;

export const toneOptions = [
  {
    value: "clear",
    label: "Clear and direct",
    prompt:
      "Write with clarity and confidence. Keep it plainspoken and punchy.",
  },
  {
    value: "warm",
    label: "Warm and human",
    prompt:
      "Write with a conversational, thoughtful tone that still feels professional.",
  },
  {
    value: "bold",
    label: "Bold and opinionated",
    prompt:
      "Write with conviction and a strong point of view, without sounding hostile.",
  },
] as const;

export type ToneOption = (typeof toneOptions)[number]["value"];

export const DEFAULT_TONE: ToneOption = toneOptions[0].value;

export const formatOptions = [
  {
    value: "post",
    label: "Single post",
    helper: "One tight X post under 280 characters.",
  },
  {
    value: "thread",
    label: "Short thread",
    helper: `Three compact ${DEFAULT_THREAD_POSTS}-part thread variants for bigger ideas.`,
  },
] as const;

export type PlatformOption = (typeof platformOptions)[number]["value"];
export type FormatOption = (typeof formatOptions)[number]["value"];
export type TextModelOption = (typeof textModelOptions)[number]["value"];
export type ImageModelOption = (typeof imageModelOptions)[number]["value"];
export type ReasoningEffortOption =
  (typeof reasoningEffortOptions)[number]["value"];
export type ImageQualityOption = (typeof imageQualityOptions)[number]["value"];

export const DEFAULT_PLATFORM: PlatformOption = platformOptions[0].value;
export const DEFAULT_FORMAT: FormatOption = formatOptions[0].value;
export const DEFAULT_REASONING_EFFORT: ReasoningEffortOption =
  reasoningEffortOptions[2].value;
export const DEFAULT_IMAGE_QUALITY: ImageQualityOption =
  imageQualityOptions[1].value;

export function isPlatformOption(value: string): value is PlatformOption {
  return platformOptions.some((platform) => platform.value === value);
}

export function isToneOption(value: string): value is ToneOption {
  return toneOptions.some((tone) => tone.value === value);
}

export function isFormatOption(value: string): value is FormatOption {
  return formatOptions.some((format) => format.value === value);
}

export function isTextModelOption(value: string): value is TextModelOption {
  return textModelOptions.some((model) => model.value === value);
}

export function isImageModelOption(value: string): value is ImageModelOption {
  return imageModelOptions.some((model) => model.value === value);
}

export function isReasoningEffortOption(
  value: string,
): value is ReasoningEffortOption {
  return reasoningEffortOptions.some((option) => option.value === value);
}

export function isImageQualityOption(
  value: string,
): value is ImageQualityOption {
  return imageQualityOptions.some((option) => option.value === value);
}

export function getTonePrompt(value: ToneOption) {
  return (
    toneOptions.find((tone) => tone.value === value)?.prompt ??
    toneOptions[0].prompt
  );
}
