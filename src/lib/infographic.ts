export const infographicVisualStyleOptions = [
  {
    value: "systems-map",
    label: "Systems map",
    helper: "Show one central mechanism with inputs, outputs, and relationships.",
    prompt:
      "Explain the concept as a clean systems map with one dominant central mechanism, directional flow, and supporting inputs and outcomes.",
  },
  {
    value: "sequence",
    label: "Step-by-step flow",
    helper: "Break the concept into a short sequence with clear progression.",
    prompt:
      "Explain the concept as a sequential flow with three or four stages, strong progression, and an obvious before-to-after arc.",
  },
  {
    value: "layered-stack",
    label: "Layered stack",
    helper: "Reveal how the concept is built from stacked components or layers.",
    prompt:
      "Explain the concept as a layered stack with a visible hierarchy, grouped components, and clear structural depth.",
  },
  {
    value: "comparison-board",
    label: "Comparison board",
    helper: "Contrast approaches, tradeoffs, or old vs new behavior.",
    prompt:
      "Explain the concept through comparison, with contrasting states or approaches and obvious visual tradeoffs.",
  },
] as const;

export type InfographicVisualStyleOption =
  (typeof infographicVisualStyleOptions)[number]["value"];

export type InfographicBlueprintPanel = {
  title: string;
  detail: string;
  accent: string;
};

export type InfographicBlueprint = {
  headline: string;
  subhead: string;
  layout: string;
  narrative: string;
  palette: string;
  panels: InfographicBlueprintPanel[];
  visualHooks: string[];
};

export const DEFAULT_INFOGRAPHIC_VISUAL_STYLE: InfographicVisualStyleOption =
  infographicVisualStyleOptions[0].value;

export function isInfographicVisualStyleOption(
  value: string,
): value is InfographicVisualStyleOption {
  return infographicVisualStyleOptions.some((option) => option.value === value);
}

export function getInfographicVisualStyleLabel(
  value: InfographicVisualStyleOption,
) {
  return (
    infographicVisualStyleOptions.find((option) => option.value === value)
      ?.label ?? infographicVisualStyleOptions[0].label
  );
}

function getInfographicVisualStylePrompt(value: InfographicVisualStyleOption) {
  return (
    infographicVisualStyleOptions.find((option) => option.value === value)
      ?.prompt ?? infographicVisualStyleOptions[0].prompt
  );
}

type BuildInfographicBlueprintPromptInput = {
  concept: string;
  audience: string;
  focus: string;
  visualStyle: InfographicVisualStyleOption;
  artDirection?: string;
};

export function buildInfographicBlueprintPrompt(
  input: BuildInfographicBlueprintPromptInput,
) {
  return [
    "Design the copy blueprint for a single explanatory infographic.",
    "Return JSON only. Do not wrap it in markdown fences.",
    "",
    `Concept: ${input.concept.trim()}`,
    `Audience: ${input.audience.trim() || "Curious technical generalists"}`,
    `Viewer takeaway: ${input.focus.trim() || "Explain how it works and why it matters"}`,
    `Preferred visual structure: ${getInfographicVisualStylePrompt(input.visualStyle)}`,
    input.artDirection?.trim()
      ? `Extra style note: ${input.artDirection.trim()}`
      : null,
    "",
    "Output requirements:",
    '- Use this exact JSON shape: {"headline":"","subhead":"","layout":"","narrative":"","palette":"","panels":[{"title":"","detail":"","accent":""}],"visualHooks":[""]}',
    "- The infographic will be rendered as rounded pastel boxes, arrows, numbered steps, and small line icons on a light paper background.",
    "- Write in plain English, not marketing language.",
    "- Keep the headline under 6 words.",
    "- Keep the subhead under 12 words.",
    "- `layout` should be one sentence describing the composition.",
    "- `narrative` should be one sentence describing the explanatory arc.",
    "- `palette` should be one short phrase naming the color direction.",
    "- Provide exactly 4 panels.",
    "- Keep each panel title under 3 words.",
    "- Keep each panel detail under 14 words.",
    "- Each panel detail should explain one important idea only.",
    "- Each panel accent should name a concrete visual motif such as arrows, orbit, stacked blocks, signal pulse, or heatmap.",
    "- Provide 4 to 6 visual hooks that would make the infographic feel clear and premium.",
    "- Make the copy feel like skimmable labels for an annotated explainer diagram.",
  ]
    .filter(Boolean)
    .join("\n");
}

type BuildFallbackInfographicBlueprintInput = {
  concept: string;
  audience: string;
  focus: string;
  visualStyle: InfographicVisualStyleOption;
};

function toHeadlineSeed(concept: string) {
  const cleaned = concept
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (cleaned.length === 0) {
    return "Concept";
  }

  return cleaned
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildFallbackInfographicBlueprint(
  input: BuildFallbackInfographicBlueprintInput,
): InfographicBlueprint {
  const concept = input.concept.trim();
  const audience = input.audience.trim() || "general technical readers";
  const focus = input.focus.trim() || "Explain how it works and why it matters";
  const visualDirection = getInfographicVisualStylePrompt(input.visualStyle);
  const headlineSeed = toHeadlineSeed(concept);

  return {
    headline: headlineSeed,
    subhead: `${focus} for ${audience}.`,
    layout: `${visualDirection} Use one dominant center with four supporting zones that move left to right from problem to outcome.`,
    narrative: `Start with the core problem, reveal the mechanism inside ${headlineSeed}, trace how it changes the process, and end on the practical payoff.`,
    palette: "Soft blue, mint, lilac, warm cream",
    panels: [
      {
        title: "Starting point",
        detail: `Frame ${concept} as the system the viewer needs to understand first.`,
        accent: "signal pulse",
      },
      {
        title: "Core move",
        detail: "Show the central operation that transforms the input into a better state.",
        accent: "orbit",
      },
      {
        title: "System flow",
        detail: "Map how the mechanism propagates through the broader workflow or stack.",
        accent: "directional arrows",
      },
      {
        title: "Why it matters",
        detail: "Land on the practical advantage, stability gain, or performance payoff.",
        accent: "stacked blocks",
      },
    ],
    visualHooks: [
      "One bright central hub anchoring the composition",
      "Directional connectors that guide the eye across the story",
      "Layered shapes that separate stages without clutter",
      "A restrained grid or field texture for technical atmosphere",
      "A final zone that visibly resolves from noisy to ordered",
    ],
  };
}
