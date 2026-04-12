export const DEFAULT_MEMEGEN_API_BASE_URL = "https://api.memegen.link";

export const memeTemplateCatalog = [
  {
    id: "buzz",
    name: "X, X Everywhere",
    lineCount: 2,
    helper: "Use when the joke is that one thing is flooding everything.",
    keywords: ["too much", "everywhere", "all over the feed"],
  },
  {
    id: "both",
    name: "Why Not Both?",
    lineCount: 2,
    helper: "Use when the answer is to take both sides, options, or wins.",
    keywords: ["both", "either or", "take both"],
  },
  {
    id: "cmm",
    name: "Change My Mind",
    lineCount: 1,
    helper: "Use for a strong take stated as a sign-worthy opinion.",
    keywords: ["opinion", "hot take", "debate"],
  },
  {
    id: "captain",
    name: "I Am the Captain Now",
    lineCount: 2,
    helper: "Use when someone seizes control or claims authority.",
    keywords: ["control", "ownership", "captain"],
  },
  {
    id: "bad",
    name: "You Should Feel Bad",
    lineCount: 2,
    helper: "Use when calling out a bad habit, weak move, or embarrassing behavior.",
    keywords: ["bad", "callout", "shame"],
  },
  {
    id: "badchoice",
    name: "Milk Was a Bad Choice",
    lineCount: 2,
    helper: "Use for obvious regret or immediate consequences.",
    keywords: ["regret", "mistake", "bad choice"],
  },
  {
    id: "bongo",
    name: "Bongo Cat",
    lineCount: 2,
    helper: "Use when contrasting two sounds, moods, or situations.",
    keywords: ["contrast", "before after", "two vibes"],
  },
  {
    id: "bilbo",
    name: "Why Shouldn't I Keep It?",
    lineCount: 2,
    helper: "Use when someone rationalizes holding onto a thing, habit, or advantage.",
    keywords: ["keep it", "justify", "cling to"],
  },
  {
    id: "bus",
    name: "Two Guys on a Bus",
    lineCount: 2,
    helper: "Use for two opposite interpretations of the same situation.",
    keywords: ["contrast", "optimist", "pessimist"],
  },
  {
    id: "center",
    name: "Center for Ants",
    lineCount: 2,
    helper: "Use when something is too small, too weak, or not enough for the job.",
    keywords: ["too small", "not enough", "tiny"],
  },
  {
    id: "fry",
    name: "Not Sure If",
    lineCount: 2,
    helper: "Use when the joke is uncertainty between two interpretations.",
    keywords: ["not sure", "confused", "unclear"],
  },
  {
    id: "rollsafe",
    name: "Roll Safe",
    lineCount: 2,
    helper: "Use for clever-but-flawed logic or smug rationalization.",
    keywords: ["big brain", "logic", "hack"],
  },
  {
    id: "oprah",
    name: "You Get X",
    lineCount: 2,
    helper: "Use when everyone gets hit with the same thing or outcome.",
    keywords: ["everyone gets", "all of you", "distribution"],
  },
  {
    id: "blb",
    name: "Bad Luck Brian",
    lineCount: 2,
    helper: "Use when a plan backfires in the most unlucky way possible.",
    keywords: ["unlucky", "backfire", "fails anyway"],
  },
] as const;

export type MemeTemplateId = (typeof memeTemplateCatalog)[number]["id"];

export function isMemeTemplateId(value: string): value is MemeTemplateId {
  return memeTemplateCatalog.some((template) => template.id === value);
}

export function getMemeTemplate(templateId: string) {
  return memeTemplateCatalog.find((template) => template.id === templateId) ?? null;
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
