export const mediumImageStyleOptions = [
  {
    value: "editorial",
    label: "Editorial illustration",
    prompt:
      "Editorial illustration with a clear focal subject, magazine-cover energy, and a grounded concept tied to the article.",
  },
  {
    value: "minimal",
    label: "Minimalist poster",
    prompt:
      "Minimalist poster-style artwork with bold shapes, restrained detail, and a memorable silhouette.",
  },
  {
    value: "infographic",
    label: "Infographic",
    prompt:
      "Infographic-inspired editorial artwork with clean visual storytelling, simple diagrams or symbolic chart motifs, and no readable text.",
  },
  {
    value: "two-dimensional",
    label: "2D illustration",
    prompt:
      "Clean 2D illustration with approachable forms, readable depth, and polished magazine-art direction.",
  },
  {
    value: "realistic",
    label: "Realistic scene",
    prompt:
      "Realistic editorial scene with natural lighting, believable materials, and a concrete human or environmental moment.",
  },
] as const;

export type MediumImageStyleOption =
  (typeof mediumImageStyleOptions)[number]["value"];

export const DEFAULT_MEDIUM_IMAGE_STYLE: MediumImageStyleOption =
  mediumImageStyleOptions[0].value;

export function isMediumImageStyleOption(
  value: string,
): value is MediumImageStyleOption {
  return mediumImageStyleOptions.some((option) => option.value === value);
}

export function getMediumImageStyleLabel(value: MediumImageStyleOption) {
  return (
    mediumImageStyleOptions.find((option) => option.value === value)?.label ??
    mediumImageStyleOptions[0].label
  );
}

function getMediumImageStylePrompt(value: MediumImageStyleOption) {
  return (
    mediumImageStyleOptions.find((option) => option.value === value)?.prompt ??
    mediumImageStyleOptions[0].prompt
  );
}

type BuildMediumLeadImagePromptInput = {
  brief: string;
  audience: string;
  mediumGoal: string;
  imageStyle: MediumImageStyleOption;
  title?: string;
  excerpt?: string;
  customPrompt?: string;
};

export function buildMediumLeadImagePrompt(
  input: BuildMediumLeadImagePromptInput,
) {
  const customPrompt = input.customPrompt?.trim();

  if (customPrompt) {
    return customPrompt;
  }

  const sections = [
    "Create a compelling Medium lead image for this article.",
    input.title?.trim() ? `Article title: ${input.title.trim()}` : null,
    `Article angle: ${
      input.brief.trim() ||
      "Translate the story seed into one concrete editorial concept."
    }`,
    `Target reader: ${input.audience.trim() || "General professional audience"}`,
    `Article goal: ${input.mediumGoal.trim() || "Teach a practical lesson"}`,
    input.excerpt?.trim()
      ? `Supporting context: ${input.excerpt.trim()}`
      : null,
    "",
    "Visual direction:",
    `- ${getMediumImageStylePrompt(input.imageStyle)}`,
    "- Landscape hero image for a Medium story",
    "- Strong focal point and simple composition that reads quickly in a feed",
    "- Specific to the article idea, not generic stock imagery",
    "- Avoid abstract AI mush, surreal clutter, and overloaded detail",
    "- No text, labels, captions, logos, watermarks, borders, device mockups, or split panels",
    "- Polished, professional, attention-grabbing, and easy to understand at a glance",
  ].filter(Boolean);

  return sections.join("\n");
}
