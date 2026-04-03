import {
  getInfographicVisualStyleLabel,
  type InfographicBlueprint,
  type InfographicBlueprintPanel,
  type InfographicVisualStyleOption,
} from "@/lib/infographic";

type InfographicRenderInput = {
  concept: string;
  focus: string;
  blueprint: InfographicBlueprint;
  visualStyle: InfographicVisualStyleOption;
};

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Theme = {
  background: string;
  backgroundShade: string;
  ink: string;
  muted: string;
  dashed: string;
  cards: [string, string, string, string];
  band: string;
};

const WIDTH = 1440;
const HEIGHT = 960;
const HAND_FONT = "'Chalkboard SE', 'Comic Sans MS', 'Marker Felt', cursive";
const UI_FONT = "'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function wrapText(value: string, maxCharsPerLine: number, maxLines = 4) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxCharsPerLine || current.length === 0) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remainingWords = words.slice(consumedWords);
  const tail = remainingWords.join(" ").trim();
  const lastLine = current || tail;

  if (lines.length < maxLines) {
    lines.push(lastLine);
  }

  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;

  if (usedWords < words.length) {
    const lastIndex = lines.length - 1;
    const trimmed = lines[lastIndex].replace(/[.,;:!?-]*$/, "");
    lines[lastIndex] = `${trimmed}...`;
  }

  return lines;
}

function renderTextBlock(input: {
  lines: string[];
  x: number;
  y: number;
  lineHeight: number;
  fontSize: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  fontWeight?: number;
  fontFamily?: string;
  italic?: boolean;
  letterSpacing?: number;
}) {
  const anchor = input.anchor ?? "start";
  const weight = input.fontWeight ?? 500;
  const family = input.fontFamily ?? HAND_FONT;
  const letterSpacing =
    typeof input.letterSpacing === "number"
      ? ` letter-spacing="${input.letterSpacing}"`
      : "";

  return `<text x="${input.x}" y="${input.y}" text-anchor="${anchor}" fill="${input.fill}" font-size="${input.fontSize}" font-weight="${weight}" font-family="${family}"${input.italic ? ' font-style="italic"' : ""}${letterSpacing}>${input.lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : input.lineHeight;
      return `<tspan x="${input.x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("")}</text>`;
}

function renderBadge(value: string, x: number, y: number, theme: Theme) {
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect x="0" y="0" width="154" height="48" rx="24" fill="#fffaf1" stroke="${theme.ink}" stroke-width="3"/>`,
    renderTextBlock({
      lines: [value.toUpperCase()],
      x: 77,
      y: 31,
      anchor: "middle",
      fontSize: 19,
      lineHeight: 20,
      fill: theme.ink,
      fontFamily: UI_FONT,
      fontWeight: 700,
      letterSpacing: 2.4,
    }),
    `</g>`,
  ].join("");
}

function selectTheme(paletteDescription: string): Theme {
  const palette = paletteDescription.toLowerCase();

  if (palette.includes("amber") || palette.includes("orange")) {
    return {
      background: "#f8f2e5",
      backgroundShade: "#f0e2cf",
      ink: "#1f1916",
      muted: "#5f564d",
      dashed: "#665d54",
      cards: ["#dbe5fb", "#d8efce", "#eadcf8", "#f8e7c6"],
      band: "#ecf0e4",
    };
  }

  if (palette.includes("purple") || palette.includes("lilac")) {
    return {
      background: "#f7f1e8",
      backgroundShade: "#efe5dc",
      ink: "#1f1916",
      muted: "#5f564d",
      dashed: "#665d54",
      cards: ["#d8e6fb", "#d9efdc", "#eadffa", "#f7e9c7"],
      band: "#eef1e7",
    };
  }

  if (
    palette.includes("cyan") ||
    palette.includes("mint") ||
    palette.includes("blue")
  ) {
    return {
      background: "#f7f2e7",
      backgroundShade: "#ebe3d5",
      ink: "#1f1916",
      muted: "#5a534c",
      dashed: "#665d54",
      cards: ["#d7e6fb", "#d9efdb", "#eadcf6", "#f7ebc6"],
      band: "#e6efe3",
    };
  }

  return {
    background: "#f7f2e7",
    backgroundShade: "#ede4d6",
    ink: "#1f1916",
    muted: "#5f564d",
    dashed: "#665d54",
    cards: ["#d9e5fb", "#dcefd3", "#eadcf7", "#f8e8c5"],
    band: "#e8efe4",
  };
}

function resolveIcon(panel: InfographicBlueprintPanel) {
  const haystack = `${panel.title} ${panel.detail} ${panel.accent}`.toLowerCase();

  if (
    haystack.includes("orbit") ||
    haystack.includes("rotate") ||
    haystack.includes("orthogonal")
  ) {
    return "orbit";
  }

  if (haystack.includes("pulse") || haystack.includes("signal")) {
    return "pulse";
  }

  if (
    haystack.includes("stack") ||
    haystack.includes("layer") ||
    haystack.includes("block")
  ) {
    return "stack";
  }

  if (
    haystack.includes("arrow") ||
    haystack.includes("flow") ||
    haystack.includes("path")
  ) {
    return "arrows";
  }

  if (
    haystack.includes("compare") ||
    haystack.includes("tradeoff") ||
    haystack.includes("versus")
  ) {
    return "compare";
  }

  if (
    haystack.includes("gear") ||
    haystack.includes("mechanism") ||
    haystack.includes("core")
  ) {
    return "gear";
  }

  if (
    haystack.includes("check") ||
    haystack.includes("verify") ||
    haystack.includes("stable")
  ) {
    return "check";
  }

  if (
    haystack.includes("chart") ||
    haystack.includes("metric") ||
    haystack.includes("result")
  ) {
    return "chart";
  }

  return "spark";
}

function renderIcon(kind: string, x: number, y: number, stroke: string) {
  switch (kind) {
    case "orbit":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="0" cy="0" r="16"/><ellipse cx="0" cy="0" rx="24" ry="9"/><path d="M18 -12a24 9 0 0 1 0 24"/><circle cx="22" cy="-6" r="2.6" fill="${stroke}" stroke="none"/></g>`;
    case "pulse":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="0" cy="0" r="22"/><path d="M-18 1h8l5-11 7 20 6-12h10"/></g>`;
    case "stack":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><rect x="-18" y="-16" width="34" height="20" rx="6"/><rect x="-10" y="-4" width="34" height="20" rx="6"/><rect x="-2" y="8" width="34" height="20" rx="6"/></g>`;
    case "arrows":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M-24 -10h34"/><path d="M4 -18l10 8-10 8"/><path d="M-16 12h34"/><path d="M12 4l10 8-10 8"/></g>`;
    case "compare":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M-20 -14h24"/><path d="M-4 -22l10 8-10 8"/><path d="M20 14H-4"/><path d="M4 6l-10 8 10 8"/></g>`;
    case "gear":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="0" cy="0" r="13"/><circle cx="0" cy="0" r="24"/><path d="M0-32v8M23-23l-6 6M32 0h-8M23 23l-6-6M0 32v-8M-23 23l6-6M-32 0h8M-23-23l6 6"/></g>`;
    case "check":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="0" cy="0" r="22"/><path d="M-9 1l6 7 13-15"/></g>`;
    case "chart":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M-24 20V-18"/><path d="M-24 20H24"/><rect x="-14" y="-4" width="8" height="24" rx="2"/><rect x="-1" y="-12" width="8" height="32" rx="2"/><rect x="12" y="-20" width="8" height="40" rx="2"/></g>`;
    default:
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M0-24l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/></g>`;
  }
}

function renderCard(input: {
  panel: InfographicBlueprintPanel;
  box: Box;
  fill: string;
  theme: Theme;
  dashed?: boolean;
  centered?: boolean;
  titleSize?: number;
  detailSize?: number;
}) {
  const titleLines = wrapText(input.panel.title, 14, 2);
  const detailChars = Math.max(16, Math.floor((input.box.w - 56) / 10));
  const detailLines = wrapText(input.panel.detail, detailChars, 5);
  const icon = renderIcon(
    resolveIcon(input.panel),
    input.box.x + input.box.w - 56,
    input.box.y + 48,
    input.theme.ink,
  );
  const titleX = input.centered ? input.box.x + input.box.w / 2 : input.box.x + 28;
  const detailX = input.centered ? input.box.x + input.box.w / 2 : input.box.x + 28;
  const anchor = input.centered ? "middle" : "start";

  return [
    `<g filter="url(#shadow)">`,
    `<rect x="${input.box.x}" y="${input.box.y}" width="${input.box.w}" height="${input.box.h}" rx="30" fill="${input.fill}" stroke="${input.theme.ink}" stroke-width="3.2"${input.dashed ? ' stroke-dasharray="11 10"' : ""}/>`,
    `</g>`,
    icon,
    renderTextBlock({
      lines: titleLines,
      x: titleX,
      y: input.box.y + 48,
      lineHeight: (input.titleSize ?? 24) + 4,
      fontSize: input.titleSize ?? 24,
      fill: input.theme.ink,
      anchor,
      fontWeight: 700,
    }),
    renderTextBlock({
      lines: detailLines,
      x: detailX,
      y: input.box.y + 98,
      lineHeight: (input.detailSize ?? 16) + 5,
      fontSize: input.detailSize ?? 16,
      fill: input.theme.ink,
      anchor,
      fontWeight: 500,
    }),
  ].join("");
}

function renderNote(input: {
  title?: string;
  body: string;
  box: Box;
  theme: Theme;
}) {
  const bodyLines = wrapText(input.body, Math.max(18, Math.floor((input.box.w - 54) / 10)), 5);
  const titleLines = input.title ? wrapText(input.title, 22, 2) : [];
  const titleHeight = titleLines.length > 0 ? 34 : 0;

  return [
    `<rect x="${input.box.x}" y="${input.box.y}" width="${input.box.w}" height="${input.box.h}" rx="26" fill="#fffaf1" stroke="${input.theme.dashed}" stroke-width="3" stroke-dasharray="10 10"/>`,
    titleLines.length > 0
      ? renderTextBlock({
          lines: titleLines,
          x: input.box.x + input.box.w / 2,
          y: input.box.y + 40,
          anchor: "middle",
          lineHeight: 26,
          fontSize: 21,
          fill: input.theme.ink,
          fontWeight: 700,
        })
      : "",
    renderTextBlock({
      lines: bodyLines,
      x: input.box.x + input.box.w / 2,
      y: input.box.y + 42 + titleHeight,
      anchor: "middle",
      lineHeight: 20,
      fontSize: 15,
      fill: input.theme.ink,
    }),
  ].join("");
}

function renderArrow(d: string, theme: Theme, dashed = false) {
  return `<path d="${d}" fill="none" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrowhead)"${dashed ? ' stroke-dasharray="9 11"' : ""}/>`;
}

function renderStepNumber(step: number, x: number, y: number, theme: Theme) {
  return [
    `<circle cx="${x}" cy="${y}" r="18" fill="#fff8ed" stroke="${theme.ink}" stroke-width="3"/>`,
    renderTextBlock({
      lines: [String(step)],
      x,
      y: y + 8,
      anchor: "middle",
      lineHeight: 18,
      fontSize: 18,
      fill: theme.ink,
      fontFamily: UI_FONT,
      fontWeight: 800,
    }),
  ].join("");
}

function renderHeader(
  headline: string,
  subhead: string,
  visualStyle: InfographicVisualStyleOption,
  theme: Theme,
) {
  const headlineLines = wrapText(headline, 28, 2);
  const subheadLines = wrapText(subhead, 60, 2);

  return [
    renderBadge(getInfographicVisualStyleLabel(visualStyle), 44, 36, theme),
    renderTextBlock({
      lines: headlineLines,
      x: WIDTH / 2,
      y: 78,
      anchor: "middle",
      lineHeight: 54,
      fontSize: 54,
      fill: theme.ink,
      fontWeight: 800,
    }),
    renderTextBlock({
      lines: subheadLines,
      x: WIDTH / 2,
      y: 138,
      anchor: "middle",
      lineHeight: 28,
      fontSize: 26,
      fill: theme.muted,
      italic: true,
    }),
  ].join("");
}

function renderFooter(copy: string, theme: Theme) {
  const lines = wrapText(copy, 76, 2);

  return renderTextBlock({
    lines,
    x: WIDTH / 2,
    y: HEIGHT - 44,
    anchor: "middle",
    lineHeight: 26,
    fontSize: 24,
    fill: theme.ink,
    fontWeight: 700,
  });
}

function renderSystemsMap(input: InfographicRenderInput, theme: Theme) {
  const [topPanel, rightPanel, leftPanel, calloutPanel] = input.blueprint.panels;
  const topBox = { x: 505, y: 182, w: 430, h: 186 };
  const rightBox = { x: 938, y: 452, w: 310, h: 188 };
  const leftBox = { x: 170, y: 492, w: 310, h: 188 };
  const noteBox = { x: 466, y: 402, w: 420, h: 122 };
  const calloutBox = { x: 1052, y: 204, w: 286, h: 250 };

  return [
    renderCard({
      panel: topPanel,
      box: topBox,
      fill: theme.cards[0],
      theme,
      centered: true,
      titleSize: 30,
      detailSize: 17,
    }),
    renderCard({
      panel: rightPanel,
      box: rightBox,
      fill: theme.cards[1],
      theme,
      centered: true,
      titleSize: 28,
      detailSize: 16,
    }),
    renderCard({
      panel: leftPanel,
      box: leftBox,
      fill: theme.cards[2],
      theme,
      centered: true,
      titleSize: 28,
      detailSize: 16,
    }),
    renderCard({
      panel: calloutPanel,
      box: calloutBox,
      fill: "#fffaf0",
      theme,
      dashed: true,
      titleSize: 24,
      detailSize: 16,
    }),
    renderNote({
      title: "How it clicks",
      body: input.blueprint.narrative,
      box: noteBox,
      theme,
    }),
    renderArrow(
      "M895 304 C1004 332 1075 386 1093 452",
      theme,
    ),
    renderArrow(
      "M938 596 C798 718 572 742 425 648",
      theme,
    ),
    renderArrow(
      "M268 492 C228 326 319 214 505 234",
      theme,
    ),
    renderArrow(
      "M1052 336 C1008 348 968 370 929 414",
      theme,
      true,
    ),
    renderStepNumber(1, 962, 314, theme),
    renderStepNumber(2, 682, 672, theme),
    renderStepNumber(3, 252, 362, theme),
  ].join("");
}

function renderSequence(input: InfographicRenderInput, theme: Theme) {
  const boxes: Box[] = [
    { x: 86, y: 336, w: 270, h: 218 },
    { x: 410, y: 336, w: 270, h: 218 },
    { x: 734, y: 336, w: 270, h: 218 },
    { x: 1058, y: 336, w: 270, h: 218 },
  ];

  return [
    renderNote({
      title: "Flow",
      body: input.blueprint.layout,
      box: { x: 322, y: 196, w: 796, h: 94 },
      theme,
    }),
    ...input.blueprint.panels.map((panel, index) =>
      renderCard({
        panel,
        box: boxes[index],
        fill: theme.cards[index],
        theme,
        centered: true,
        titleSize: 28,
        detailSize: 16,
      }),
    ),
    renderArrow("M356 445 H410", theme),
    renderArrow("M680 445 H734", theme),
    renderArrow("M1004 445 H1058", theme),
    renderStepNumber(1, 384, 306, theme),
    renderStepNumber(2, 708, 306, theme),
    renderStepNumber(3, 1032, 306, theme),
  ].join("");
}

function renderLayeredStack(input: InfographicRenderInput, theme: Theme) {
  const boxes: Box[] = [
    { x: 104, y: 458, w: 270, h: 224 },
    { x: 420, y: 458, w: 270, h: 224 },
    { x: 736, y: 458, w: 270, h: 224 },
    { x: 1052, y: 458, w: 270, h: 224 },
  ];

  return [
    `<rect x="56" y="388" width="1328" height="374" rx="34" fill="${theme.band}" stroke="${theme.dashed}" stroke-width="3" stroke-dasharray="10 10"/>`,
    renderTextBlock({
      lines: ["Layered explainer stack"],
      x: 94,
      y: 430,
      lineHeight: 24,
      fontSize: 24,
      fill: theme.ink,
      fontWeight: 700,
    }),
    renderNote({
      title: "Structure",
      body: input.blueprint.narrative,
      box: { x: 462, y: 214, w: 516, h: 110 },
      theme,
    }),
    ...input.blueprint.panels.map((panel, index) =>
      renderCard({
        panel,
        box: boxes[index],
        fill: theme.cards[index],
        theme,
        titleSize: 24,
        detailSize: 15,
      }),
    ),
    renderArrow("M374 570 H420", theme),
    renderArrow("M690 570 H736", theme),
    renderArrow("M1006 570 H1052", theme),
  ].join("");
}

function renderComparisonBoard(input: InfographicRenderInput, theme: Theme) {
  const leftTop = { x: 120, y: 280, w: 430, h: 210 };
  const leftBottom = { x: 120, y: 534, w: 430, h: 210 };
  const rightTop = { x: 890, y: 280, w: 430, h: 210 };
  const rightBottom = { x: 890, y: 534, w: 430, h: 210 };

  return [
    renderNote({
      title: "Decision lens",
      body: input.blueprint.narrative,
      box: { x: 570, y: 376, w: 300, h: 252 },
      theme,
    }),
    renderCard({
      panel: input.blueprint.panels[0],
      box: leftTop,
      fill: theme.cards[0],
      theme,
      titleSize: 28,
      detailSize: 16,
    }),
    renderCard({
      panel: input.blueprint.panels[1],
      box: leftBottom,
      fill: theme.cards[2],
      theme,
      titleSize: 28,
      detailSize: 16,
    }),
    renderCard({
      panel: input.blueprint.panels[2],
      box: rightTop,
      fill: theme.cards[3],
      theme,
      titleSize: 28,
      detailSize: 16,
    }),
    renderCard({
      panel: input.blueprint.panels[3],
      box: rightBottom,
      fill: theme.cards[1],
      theme,
      titleSize: 28,
      detailSize: 16,
    }),
    renderArrow("M550 386 C610 386 630 420 570 430", theme),
    renderArrow("M870 430 C810 420 790 386 890 386", theme),
    renderArrow("M550 638 C610 638 630 604 570 594", theme),
    renderArrow("M870 594 C810 604 790 638 890 638", theme),
  ].join("");
}

function renderLayout(input: InfographicRenderInput, theme: Theme) {
  switch (input.visualStyle) {
    case "sequence":
      return renderSequence(input, theme);
    case "layered-stack":
      return renderLayeredStack(input, theme);
    case "comparison-board":
      return renderComparisonBoard(input, theme);
    case "systems-map":
    default:
      return renderSystemsMap(input, theme);
  }
}

export function buildInfographicSvgMarkup(input: InfographicRenderInput) {
  const theme = selectTheme(input.blueprint.palette);
  const footerCopy = input.focus.trim() || input.blueprint.subhead;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${escapeXml(`Infographic explaining ${input.concept}`)}">`,
    `<defs>`,
    `<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.08"/>`,
    `</filter>`,
    `<marker id="arrowhead" viewBox="0 0 14 14" refX="11" refY="7" markerWidth="12" markerHeight="12" orient="auto-start-reverse">`,
    `<path d="M0 0L14 7L0 14Z" fill="${theme.ink}"/>`,
    `</marker>`,
    `</defs>`,
    `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" rx="36" fill="${theme.background}"/>`,
    `<ellipse cx="260" cy="180" rx="240" ry="140" fill="#ffffff" opacity="0.26"/>`,
    `<ellipse cx="1180" cy="770" rx="280" ry="160" fill="${theme.backgroundShade}" opacity="0.5"/>`,
    `<path d="M70 814C252 740 386 738 556 792C748 852 930 846 1166 756C1266 718 1334 708 1376 710" fill="none" stroke="${theme.backgroundShade}" stroke-width="22" stroke-linecap="round" opacity="0.45"/>`,
    renderHeader(
      input.blueprint.headline,
      input.blueprint.subhead,
      input.visualStyle,
      theme,
    ),
    renderLayout(input, theme),
    renderFooter(footerCopy, theme),
    `</svg>`,
  ].join("");
}

export function buildInfographicSvgDataUrl(svgMarkup: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svgMarkup).toString("base64")}`;
}

