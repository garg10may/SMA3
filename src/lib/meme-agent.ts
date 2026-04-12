export const DEFAULT_MEMEGEN_API_BASE_URL = "https://api.memegen.link";
const TEMPLATE_CACHE_TTL_MS = 60 * 60 * 1000;

export type MemeTemplate = {
  id: string;
  name: string;
  lines: number;
  overlays: number;
  styles: string[];
  blank: string;
  example: {
    text: string[];
    url: string;
  };
  source?: string;
  keywords: string[];
  _self?: string;
};

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeTemplateId(value: string) {
  return toTitleCase(value.replace(/[-_]+/g, " "));
}

const fallbackMemeTemplateCatalog: MemeTemplate[] = [
  {
    id: "buzz",
    name: "X, X Everywhere",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/buzz.jpg`,
    example: {
      text: ["code", "code everywhere"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/buzz/code/code_everywhere.jpg`,
    },
    keywords: ["too much", "everywhere", "all over the feed"],
  },
  {
    id: "both",
    name: "Why Not Both?",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/both.jpg`,
    example: {
      text: ["shipping", "quality"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/both/shipping/quality.jpg`,
    },
    keywords: ["both", "either or", "take both"],
  },
  {
    id: "cmm",
    name: "Change My Mind",
    lines: 1,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/cmm.jpg`,
    example: {
      text: ["ship the boring tools first"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/cmm/ship_the_boring_tools_first.jpg`,
    },
    keywords: ["opinion", "hot take", "debate"],
  },
  {
    id: "captain",
    name: "I Am the Captain Now",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/captain.jpg`,
    example: {
      text: ["when ops takes over", "i am the captain now"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/captain/when_ops_takes_over/i_am_the_captain_now.jpg`,
    },
    keywords: ["control", "ownership", "captain"],
  },
  {
    id: "badchoice",
    name: "Milk Was a Bad Choice",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/badchoice.jpg`,
    example: {
      text: ["ten dashboards", "was a bad choice"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/badchoice/ten_dashboards/was_a_bad_choice.jpg`,
    },
    keywords: ["regret", "mistake", "bad choice"],
  },
  {
    id: "fry",
    name: "Not Sure If",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/fry.jpg`,
    example: {
      text: ["not sure if strategy", "or dashboard addiction"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/fry/not_sure_if_strategy/or_dashboard_addiction.jpg`,
    },
    keywords: ["not sure", "confused", "unclear"],
  },
  {
    id: "rollsafe",
    name: "Roll Safe",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/rollsafe.jpg`,
    example: {
      text: ["cant lose focus", "if you never pick a metric"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/rollsafe/cant_lose_focus/if_you_never_pick_a_metric.jpg`,
    },
    keywords: ["big brain", "logic", "hack"],
  },
  {
    id: "blb",
    name: "Bad Luck Brian",
    lines: 2,
    overlays: 0,
    styles: [],
    blank: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/blb.jpg`,
    example: {
      text: ["builds ten dashboards", "still no clarity"],
      url: `${DEFAULT_MEMEGEN_API_BASE_URL}/images/blb/builds_ten_dashboards/still_no_clarity.jpg`,
    },
    keywords: ["unlucky", "backfire", "fails anyway"],
  },
];

let cachedTemplates: MemeTemplate[] | null = null;
let cachedTemplatesAt = 0;

function normalizeTemplateList(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Memegen templates response is not an array.");
  }

  const templates = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const template = entry as Partial<MemeTemplate>;

      if (
        typeof template.id !== "string" ||
        typeof template.name !== "string" ||
        typeof template.lines !== "number" ||
        typeof template.blank !== "string"
      ) {
        return null;
      }

      const normalizedName =
        typeof template.name === "string" && template.name.trim()
          ? template.name.trim()
          : humanizeTemplateId(template.id);

      const normalizedTemplate: MemeTemplate = {
        id: template.id,
        name: normalizedName,
        lines: template.lines,
        overlays: typeof template.overlays === "number" ? template.overlays : 0,
        styles: Array.isArray(template.styles)
          ? template.styles.filter((style): style is string => typeof style === "string")
          : [],
        blank: template.blank,
        example:
          template.example &&
          typeof template.example === "object" &&
          Array.isArray(template.example.text) &&
          typeof template.example.url === "string"
            ? {
                text: template.example.text.map((line) => String(line)),
                url: template.example.url,
              }
            : {
                text: [],
                url: template.blank,
              },
        source: typeof template.source === "string" ? template.source : undefined,
        keywords: Array.isArray(template.keywords)
          ? template.keywords.filter(
              (keyword): keyword is string => typeof keyword === "string",
            )
          : [],
        _self: typeof template._self === "string" ? template._self : undefined,
      };

      return normalizedTemplate;
    })
    .filter((template): template is MemeTemplate => template !== null);

  const dedupedTemplates = new Map<string, MemeTemplate>();

  for (const template of templates) {
    const current = dedupedTemplates.get(template.id);

    if (!current) {
      dedupedTemplates.set(template.id, template);
      continue;
    }

    const currentKeywordCount = current.keywords.length;
    const nextKeywordCount = template.keywords.length;
    const currentHasSource = Boolean(current.source);
    const nextHasSource = Boolean(template.source);
    const currentExampleLines = current.example.text.length;
    const nextExampleLines = template.example.text.length;

    if (
      nextHasSource && !currentHasSource ||
      nextKeywordCount > currentKeywordCount ||
      nextExampleLines > currentExampleLines
    ) {
      dedupedTemplates.set(template.id, template);
    }
  }

  return Array.from(dedupedTemplates.values());
}

export async function fetchMemegenTemplates(options?: {
  forceFresh?: boolean;
  baseUrl?: string;
}): Promise<MemeTemplate[]> {
  const now = Date.now();

  if (
    !options?.forceFresh &&
    cachedTemplates &&
    now - cachedTemplatesAt < TEMPLATE_CACHE_TTL_MS
  ) {
    return cachedTemplates;
  }

  const baseUrl = options?.baseUrl ?? DEFAULT_MEMEGEN_API_BASE_URL;
  const response = await fetch(`${baseUrl}/templates/`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Memegen templates request failed with ${response.status}.`);
  }

  const templates = normalizeTemplateList(await response.json()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  cachedTemplates = templates;
  cachedTemplatesAt = now;

  return templates;
}

export async function getMemeTemplateCatalog(options?: {
  forceFresh?: boolean;
  baseUrl?: string;
}): Promise<MemeTemplate[]> {
  try {
    const templates = await fetchMemegenTemplates(options);

    if (templates.length > 0) {
      return templates;
    }
  } catch {}

  return fallbackMemeTemplateCatalog;
}

export function getFallbackMemeTemplateCatalog(): MemeTemplate[] {
  return fallbackMemeTemplateCatalog;
}

export async function isMemeTemplateId(value: string) {
  const templates = await getMemeTemplateCatalog();
  return templates.some((template) => template.id === value);
}

export async function getMemeTemplate(templateId: string) {
  const templates = await getMemeTemplateCatalog();
  return templates.find((template) => template.id === templateId) ?? null;
}

export function getMemeTemplateBlankUrl(
  templateId: string,
  baseUrl = DEFAULT_MEMEGEN_API_BASE_URL,
) {
  return `${baseUrl}/images/${templateId}.jpg`;
}

function escapeMemegenLine(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "_";
  }

  return trimmed
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replaceAll("_", "__")
    .replaceAll("-", "--")
    .replaceAll("?", "~q")
    .replaceAll("&", "~a")
    .replaceAll("%", "~p")
    .replaceAll("#", "~h")
    .replaceAll("/", "~s")
    .replaceAll("\\", "~b")
    .replaceAll("<", "~l")
    .replaceAll(">", "~g")
    .replaceAll('"', "''")
    .replaceAll("\n", "~n")
    .replace(/\s/g, "_");
}

export function normalizeMemeLines(lines: string[], lineCount: number) {
  return Array.from({ length: lineCount }, (_, index) => lines[index]?.trim() ?? "");
}

export function buildMemegenImageUrl(
  templateId: string,
  lines: string[],
  options?: {
    baseUrl?: string;
    width?: number;
    font?: string;
  },
) {
  const baseUrl = options?.baseUrl ?? DEFAULT_MEMEGEN_API_BASE_URL;
  const path = normalizeMemeLines(lines, lines.length)
    .map(escapeMemegenLine)
    .join("/");
  const url = new URL(`${baseUrl}/images/${templateId}/${path}.png`);

  if (options?.width) {
    url.searchParams.set("width", String(options.width));
  }

  if (options?.font) {
    url.searchParams.set("font", options.font);
  }

  return url.toString();
}
