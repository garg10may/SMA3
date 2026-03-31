export const MAX_BRIEF_LENGTH = 600;
export const MAX_POST_LENGTH = 280;
export const DEFAULT_MODEL = "gpt-5-mini";

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

export function isToneOption(value: string): value is ToneOption {
  return toneOptions.some((tone) => tone.value === value);
}

export function getTonePrompt(value: ToneOption) {
  return (
    toneOptions.find((tone) => tone.value === value)?.prompt ??
    toneOptions[0].prompt
  );
}
