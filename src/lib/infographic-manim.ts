import { normalizeInfographicIcon, type InfographicPlan, type InfographicPlanBlock } from "@/lib/infographic";

type InfographicSceneInput = {
  plan: InfographicPlan;
};

type SceneBlock = {
  id: string;
  title: string;
  body: string;
  role: string;
  icon: string;
  emphasis: string;
  tint: string;
  mode: string;
};

type Position = {
  x: number;
  y: number;
  width: number;
};

const FLOW_MAX_MAIN_CARDS = 5;

function compactCopy(value: string, maxWords: number, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  let next = words.slice(0, maxWords).join(" ");

  if (next.length > maxChars) {
    next = next.slice(0, maxChars).trim();
    next = next.replace(/\s+\S*$/, "").trim() || next;
  }

  return next.replace(/[.,;:!?-]+$/, "").trim();
}

function pyString(value: string) {
  return JSON.stringify(value);
}

function toVectorExpression(x: number, y: number) {
  const horizontal =
    x === 0
      ? ""
      : `${x >= 0 ? "RIGHT" : "LEFT"} * ${Math.abs(x).toFixed(2)}`;
  const vertical =
    y === 0 ? "" : `${y >= 0 ? "UP" : "DOWN"} * ${Math.abs(y).toFixed(2)}`;

  if (horizontal && vertical) {
    return `${horizontal} + ${vertical}`;
  }

  return horizontal || vertical || "ORIGIN";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toTint(block: InfographicPlanBlock) {
  const haystack = `${block.role} ${block.title} ${block.emphasis} ${block.body}`
    .toLowerCase();

  if (
    haystack.includes("query") ||
    haystack.includes("input") ||
    haystack.includes("retriev") ||
    haystack.includes("search")
  ) {
    return "blue";
  }

  if (
    haystack.includes("output") ||
    haystack.includes("answer") ||
    haystack.includes("result") ||
    haystack.includes("trust") ||
    haystack.includes("check")
  ) {
    return "green";
  }

  if (
    haystack.includes("variant") ||
    haystack.includes("compare") ||
    haystack.includes("memory") ||
    haystack.includes("graph") ||
    haystack.includes("multimodal")
  ) {
    return "purple";
  }

  if (
    haystack.includes("warning") ||
    haystack.includes("trade") ||
    haystack.includes("cost") ||
    haystack.includes("hypothetical")
  ) {
    return "amber";
  }

  return "blue";
}

function inferComparisonMode(block: InfographicPlanBlock) {
  const haystack = `${block.title} ${block.body} ${block.role} ${block.emphasis}`
    .toLowerCase();

  if (
    haystack.includes("multi") ||
    haystack.includes("image") ||
    haystack.includes("audio") ||
    haystack.includes("cross-modal")
  ) {
    return "multimodal";
  }

  if (
    haystack.includes("hyde") ||
    haystack.includes("hypothetical") ||
    haystack.includes("bridge query")
  ) {
    return "hypothesis";
  }

  if (haystack.includes("graph")) {
    return "graph";
  }

  if (
    haystack.includes("corrective") ||
    haystack.includes("adaptive") ||
    haystack.includes("query analyzer") ||
    haystack.includes("route")
  ) {
    return "router";
  }

  if (
    haystack.includes("agentic") ||
    haystack.includes("agent") ||
    haystack.includes("tool")
  ) {
    return "agent";
  }

  if (haystack.includes("memory")) {
    return "memory";
  }

  return "standard";
}

function normalizeSceneBlock(
  block: InfographicPlanBlock,
  style: InfographicPlan["visualStyle"],
): SceneBlock {
  const maxBodyWords = style === "comparison-grid" ? 6 : 12;
  const maxBodyChars = style === "comparison-grid" ? 52 : 92;

  return {
    id: block.id,
    title: compactCopy(block.title, 4, style === "comparison-grid" ? 22 : 28)
      || "Concept",
    body: compactCopy(block.body, maxBodyWords, maxBodyChars) || "Key system step",
    role: compactCopy(block.role, 4, 28) || "stage",
    icon: normalizeInfographicIcon(block.icon),
    emphasis: compactCopy(block.emphasis, 4, 24),
    tint: toTint(block),
    mode: inferComparisonMode(block),
  };
}

function getBadgeText(style: InfographicPlan["visualStyle"]) {
  switch (style) {
    case "comparison-grid":
      return "PATTERN BOARD";
    case "feedback-loop":
      return "SYSTEM LOOP";
    default:
      return "SYSTEMS MAP";
  }
}

function buildSceneShell(
  plan: InfographicPlan,
  bodyLines: string[],
  options?: {
    titleWidth?: number;
    titleShift?: string;
    titleScale?: number;
    footerWidth?: number;
  },
) {
  const titleWidth = options?.titleWidth ?? 9.8;
  const titleShift = options?.titleShift ?? "RIGHT * 0.9";
  const titleScale = options?.titleScale ?? 0.95;
  const footerWidth = options?.footerWidth ?? 11.4;

  return [
    "from manim import *",
    "from infographic_runtime import *",
    "",
    "",
    "class InfographicScene(Scene):",
    "    def construct(self):",
    `        palette = infographic_palette(${pyString(plan.palette)})`,
    "        self.add(make_paper_background(palette))",
    `        badge = make_section_badge(${pyString(getBadgeText(plan.visualStyle))}, palette)`,
    "        badge.to_edge(LEFT, buff=0.34)",
    "        badge.to_edge(UP, buff=0.28)",
    `        title = make_title_block(${pyString(plan.headline)}, ${pyString(plan.subhead)}, palette, width=${titleWidth.toFixed(2)})`,
    "        title.to_edge(UP, buff=0.22)",
    `        title.shift(${titleShift}).scale(${titleScale.toFixed(2)})`,
    `        footer = make_footer_note(${pyString(plan.footer)}, palette, width=${footerWidth.toFixed(2)})`,
    "        footer.to_edge(DOWN, buff=0.22)",
    "        self.add(badge, title, footer)",
    "",
    ...bodyLines,
  ].join("\n");
}

function buildFlowMainPositions(count: number) {
  if (count <= 3) {
    return [
      { x: -4.6, y: 0.4, width: 2.85 },
      { x: 0, y: 0.4, width: 3.15 },
      { x: 4.6, y: 0.4, width: 2.85 },
    ].slice(0, count);
  }

  if (count === 4) {
    return [
      { x: -5.15, y: 0.42, width: 2.55 },
      { x: -1.75, y: 0.1, width: 2.8 },
      { x: 1.75, y: 0.1, width: 2.8 },
      { x: 5.15, y: 0.42, width: 2.55 },
    ];
  }

  return [
    { x: -5.35, y: 0.42, width: 2.2 },
    { x: -2.65, y: 0.08, width: 2.35 },
    { x: 0, y: 0.08, width: 2.55 },
    { x: 2.65, y: 0.08, width: 2.35 },
    { x: 5.35, y: 0.42, width: 2.2 },
  ];
}

function buildSupportPositions(count: number) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [{ x: 0, y: -2.0, width: 3.05 }];
  }

  if (count === 2) {
    return [
      { x: -3.85, y: -2.02, width: 2.95 },
      { x: 3.85, y: -2.02, width: 2.95 },
    ];
  }

  return [
    { x: -4.55, y: -2.05, width: 2.6 },
    { x: 0, y: -2.05, width: 2.9 },
    { x: 4.55, y: -2.05, width: 2.6 },
  ].slice(0, count);
}

function chooseFlowSupportPosition(block: SceneBlock, index: number, total: number) {
  const haystack = `${block.title} ${block.role} ${block.body}`.toLowerCase();
  const isSource = /knowledge|source|context|database|document|memory/.test(haystack);
  const isContrast = /plain|baseline|variant|warning|no retrieval/.test(haystack);

  if (total === 1) {
    if (isSource) {
      return { x: -1.55, y: -2.02, width: 3.05 };
    }

    if (isContrast) {
      return { x: 3.75, y: -2.02, width: 3.0 };
    }
  }

  if (total === 2) {
    if (isSource) {
      return { x: -2.35, y: -2.02, width: 2.95 };
    }

    if (isContrast) {
      return { x: 3.85, y: -2.02, width: 2.95 };
    }
  }

  return buildSupportPositions(total)[index]!;
}

function buildArchitecturePositions(blocks: SceneBlock[]) {
  const coreIndex = Math.max(
    0,
    blocks.findIndex((block) =>
      /core|main|engine|rag|agent|planner|reason/i.test(
        `${block.role} ${block.title}`,
      ),
    ),
  );
  const coreBlock = blocks[coreIndex] ?? blocks[0];
  const others = blocks.filter((_, index) => index !== coreIndex);
  const positions = new Map<string, Position>();

  positions.set(coreBlock.id, { x: 0, y: 0.92, width: 4.2 });

  if (others[0]) {
    positions.set(others[0].id, { x: -4.75, y: 0.5, width: 2.8 });
  }
  if (others[1]) {
    positions.set(others[1].id, { x: 4.75, y: 0.5, width: 2.8 });
  }

  const bottom = others.slice(2);
  const bottomSlots =
    bottom.length <= 1
      ? [{ x: 0, y: -2.0, width: 3.1 }]
      : bottom.length === 2
        ? [
          { x: -3.15, y: -2.0, width: 2.95 },
          { x: 3.15, y: -2.0, width: 2.95 },
        ]
        : [
          { x: -4.4, y: -2.02, width: 2.65 },
          { x: 0, y: -2.02, width: 2.9 },
          { x: 4.4, y: -2.02, width: 2.65 },
        ];

  bottom.forEach((block, index) => {
    const slot = bottomSlots[index];

    if (slot) {
      positions.set(block.id, slot);
    }
  });

  return { coreId: coreBlock.id, positions };
}

function buildFeedbackPositions(blocks: SceneBlock[]) {
  const positions = new Map<string, Position>();
  const primary = blocks.slice(0, 4);
  const extras = blocks.slice(4);
  const slots = [
    { x: 0, y: 1.72, width: 3.0 },
    { x: 4.45, y: 0.08, width: 2.75 },
    { x: 0, y: -2.08, width: 3.0 },
    { x: -4.45, y: 0.08, width: 2.75 },
  ];

  primary.forEach((block, index) => {
    const slot = slots[index];
    positions.set(block.id, slot);
  });

  extras.forEach((block, index) => {
    const slot =
      index === 0
        ? { x: 0, y: -0.05, width: 3.25 }
        : { x: 0, y: -1.08, width: 2.9 };
    positions.set(block.id, slot);
  });

  return positions;
}

function buildComparisonPositions(count: number) {
  const columns = count >= 7 ? 4 : count >= 5 ? 3 : 2;
  const width = columns === 4 ? 3.08 : columns === 3 ? 4.02 : 5.86;
  const xStep = columns === 4 ? 3.5 : columns === 3 ? 4.55 : 6.5;
  const yPositions = count > columns ? [0.68, -1.84] : [-0.58];
  const xStart = -((columns - 1) * xStep) / 2;

  return Array.from({ length: count }, (_, index) => {
    const row = count > columns ? Math.floor(index / columns) : 0;
    const col = count > columns ? index % columns : index;

    return {
      x: xStart + col * xStep,
      y: yPositions[row] ?? -2.18,
      width,
    };
  });
}

function buildCalloutPosition(
  placement: "left" | "right" | "top" | "bottom",
  anchor: Position,
) {
  if (placement === "left") {
    return { x: clamp(anchor.x - 3.0, -5.45, 5.45), y: anchor.y + 0.15 };
  }

  if (placement === "right") {
    return { x: clamp(anchor.x + 3.0, -5.45, 5.45), y: anchor.y + 0.15 };
  }

  if (placement === "bottom") {
    return { x: anchor.x, y: anchor.y - 1.72 };
  }

  return { x: anchor.x, y: anchor.y + 1.74 };
}

function buildFlowCalloutPosition(
  placement: "left" | "right" | "top" | "bottom",
  anchor: Position,
) {
  if (placement === "left") {
    return { x: clamp(anchor.x - 2.9, -4.95, 4.95), y: clamp(anchor.y + 0.1, -1.4, 1.55) };
  }

  if (placement === "right") {
    return { x: clamp(anchor.x + 2.9, -4.95, 4.95), y: clamp(anchor.y + 0.1, -1.4, 1.55) };
  }

  if (placement === "bottom") {
    return { x: clamp(anchor.x, -3.8, 3.8), y: -1.65 };
  }

  return { x: anchor.x >= 0 ? 4.45 : -2.45, y: 1.88 };
}

function buildFlowMapSceneSource(plan: InfographicPlan) {
  const blocks = plan.blocks.map((block) => normalizeSceneBlock(block, plan.visualStyle));
  const supportBlocks = blocks.filter((block) =>
    /support|context|source|knowledge|memory|document|database/i.test(
      `${block.role} ${block.title}`,
    ),
  );
  const preferredMainBlocks = blocks.filter((block) => !supportBlocks.includes(block))
    .slice(0, FLOW_MAX_MAIN_CARDS);
  const mainBlocks =
    preferredMainBlocks.length >= Math.min(3, blocks.length)
      ? preferredMainBlocks
      : blocks.slice(0, Math.min(FLOW_MAX_MAIN_CARDS, blocks.length));
  const lowerBlocks = blocks.filter((block) => !mainBlocks.includes(block)).slice(0, 3);
  const mainPositions = buildFlowMainPositions(mainBlocks.length);
  const positions = new Map<string, Position>();

  mainBlocks.forEach((block, index) => {
    positions.set(block.id, mainPositions[index]!);
  });
  lowerBlocks.forEach((block, index) => {
    positions.set(block.id, chooseFlowSupportPosition(block, index, lowerBlocks.length));
  });

  const lines = [
    "        cards = {}",
    "",
    ...blocks
      .filter((block) => positions.has(block.id))
      .flatMap((block, index) => {
        const position = positions.get(block.id)!;
        const minHeight =
          lowerBlocks.some((candidate) => candidate.id === block.id) ? 1.68 : 1.92;

        return [
          `        card_${index} = make_card(`,
          `            ${pyString(block.title)},`,
          `            ${pyString(block.body)},`,
          "            palette,",
          `            tint=${pyString(block.tint)},`,
          `            width=${position.width.toFixed(2)},`,
          `            min_height=${minHeight.toFixed(2)},`,
          `            icon=${pyString(block.icon)},`,
          `            eyebrow=${pyString(block.emphasis)},`,
          "        )",
          `        card_${index}.move_to(${toVectorExpression(position.x, position.y)})`,
          `        cards[${pyString(block.id)}] = card_${index}`,
          `        self.add(card_${index})`,
          "",
        ];
      }),
  ];

  const visibleIds = new Set([...positions.keys()]);
  const mainIdSet = new Set(mainBlocks.map((block) => block.id));
  const mainOrder = new Map(mainBlocks.map((block, index) => [block.id, index]));
  const connections = plan.connections.filter(
    (connection) => visibleIds.has(connection.fromId) && visibleIds.has(connection.toId),
  );
  const curatedConnections = connections.filter((connection) => {
    const fromIndex = mainOrder.get(connection.fromId);
    const toIndex = mainOrder.get(connection.toId);

    if (fromIndex !== undefined && toIndex !== undefined) {
      return (
        Math.abs(toIndex - fromIndex) === 1 ||
        connection.style === "loop"
      );
    }

    const fromPosition = positions.get(connection.fromId);
    const toPosition = positions.get(connection.toId);

    if (!fromPosition || !toPosition) {
      return false;
    }

    if (
      connection.style === "dashed" &&
      Math.abs(fromPosition.x - toPosition.x) > 5.4
    ) {
      return false;
    }

    return true;
  });

  let badgeIndex = 0;
  curatedConnections.forEach((connection, index) => {
    const fromPosition = positions.get(connection.fromId)!;
    const toPosition = positions.get(connection.toId)!;
    const bothMain =
      mainIdSet.has(connection.fromId) &&
      mainIdSet.has(connection.toId) &&
      connection.style === "solid";
    const curve =
      connection.style === "loop"
        ? 0.78
        : Math.abs(fromPosition.y - toPosition.y) > 1
          ? 0.16
          : 0.0;
    const midX = (fromPosition.x + toPosition.x) / 2;
    const midY = (fromPosition.y + toPosition.y) / 2;

    lines.push(
      `        link_${index} = connect_cards(`,
      `            cards[${pyString(connection.fromId)}],`,
      `            cards[${pyString(connection.toId)}],`,
      "            palette,",
      "            label='',",
      `            style=${pyString(connection.style)},`,
      `            curve=${curve.toFixed(2)},`,
      "        )",
      `        self.add(link_${index})`,
    );

    if (bothMain) {
      badgeIndex += 1;
      lines.push(
        `        step_${index} = make_step_badge(${pyString(String(badgeIndex))}, palette)`,
        `        step_${index}.move_to(${toVectorExpression(midX, midY + 0.55)})`,
        `        self.add(step_${index})`,
      );
    }

    lines.push("");
  });

  plan.callouts.slice(0, 1).forEach((callout, index) => {
    const anchor = positions.get(callout.anchorId);

    if (!anchor) {
      return;
    }

    const calloutPosition = buildFlowCalloutPosition(callout.placement, anchor);
    const width = callout.placement === "top" ? 2.45 : 2.55;

    lines.push(
      `        callout_${index} = make_callout(`,
      `            ${pyString(compactCopy(callout.title, 5, 28) || "Note")},`,
      `            ${pyString(compactCopy(callout.body, 8, 64) || "Useful design note")},`,
      "            palette,",
      `            width=${width.toFixed(2)},`,
      `            icon=${pyString(normalizeInfographicIcon(callout.icon))},`,
      "        )",
      `        callout_${index}.move_to(${toVectorExpression(calloutPosition.x, calloutPosition.y)})`,
      `        self.add(callout_${index})`,
      "",
    );
  });

  return buildSceneShell(plan, lines, {
    titleWidth: 8.8,
    titleShift: "RIGHT * 0.75 + DOWN * 0.02",
    titleScale: 0.93,
    footerWidth: 12.0,
  });
}

function buildArchitectureBoardSceneSource(plan: InfographicPlan) {
  const blocks = plan.blocks.map((block) => normalizeSceneBlock(block, plan.visualStyle));
  const { coreId, positions } = buildArchitecturePositions(blocks);
  const lines = [
    "        cards = {}",
    "",
    ...blocks.flatMap((block, index) => {
      const position = positions.get(block.id);

      if (!position) {
        return [];
      }

      return [
        `        card_${index} = make_card(`,
        `            ${pyString(block.title)},`,
        `            ${pyString(block.body)},`,
        "            palette,",
        `            tint=${pyString(block.id === coreId ? "blue" : block.tint)},`,
        `            width=${position.width.toFixed(2)},`,
        `            min_height=${block.id === coreId ? "2.12" : "1.82"},`,
        `            icon=${pyString(block.icon)},`,
        `            eyebrow=${pyString(block.emphasis)},`,
        "        )",
        `        card_${index}.move_to(${toVectorExpression(position.x, position.y)})`,
        `        cards[${pyString(block.id)}] = card_${index}`,
        `        self.add(card_${index})`,
        "",
      ];
    }),
  ];

  const visibleIds = new Set([...positions.keys()]);
  const connections = plan.connections.filter(
    (connection) => visibleIds.has(connection.fromId) && visibleIds.has(connection.toId),
  );

  connections.forEach((connection, index) => {
    const fromPosition = positions.get(connection.fromId)!;
    const toPosition = positions.get(connection.toId)!;
    const curve =
      connection.style === "loop"
        ? 0.7
        : Math.abs(fromPosition.x - toPosition.x) > 6
          ? 0.2
          : 0.0;

    lines.push(
      `        link_${index} = connect_cards(`,
      `            cards[${pyString(connection.fromId)}],`,
      `            cards[${pyString(connection.toId)}],`,
      "            palette,",
      `            label=${pyString(compactCopy(connection.label, 6, 30))},`,
      `            style=${pyString(connection.style)},`,
      `            curve=${curve.toFixed(2)},`,
      "        )",
      `        self.add(link_${index})`,
      "",
    );
  });

  plan.callouts.slice(0, 2).forEach((callout, index) => {
    const anchor = positions.get(callout.anchorId);

    if (!anchor) {
      return;
    }

    const nextPosition = buildCalloutPosition(callout.placement, anchor);

    lines.push(
      `        callout_${index} = make_callout(`,
      `            ${pyString(compactCopy(callout.title, 5, 30) || "Why it matters")},`,
      `            ${pyString(compactCopy(callout.body, 12, 90) || "Short architectural note")},`,
      "            palette,",
      `            width=${callout.placement === "top" ? "3.0" : "2.82"},`,
      `            icon=${pyString(normalizeInfographicIcon(callout.icon))},`,
      "        )",
      `        callout_${index}.move_to(${toVectorExpression(nextPosition.x, nextPosition.y)})`,
      `        callout_link_${index} = connect_cards(cards[${pyString(callout.anchorId)}], callout_${index}, palette, style='dashed', curve=0.1)`,
      `        self.add(callout_${index}, callout_link_${index})`,
      "",
    );
  });

  return buildSceneShell(plan, lines, {
    titleWidth: 9.5,
    titleShift: "RIGHT * 0.7",
    titleScale: 0.94,
  });
}

function buildFeedbackLoopSceneSource(plan: InfographicPlan) {
  const blocks = plan.blocks.map((block) => normalizeSceneBlock(block, plan.visualStyle));
  const positions = buildFeedbackPositions(blocks);
  const primaryBlocks = blocks.slice(0, 4);
  const lines = [
    "        cards = {}",
    "",
    ...blocks.flatMap((block, index) => {
      const position = positions.get(block.id);

      if (!position) {
        return [];
      }

      return [
        `        card_${index} = make_card(`,
        `            ${pyString(block.title)},`,
        `            ${pyString(block.body)},`,
        "            palette,",
        `            tint=${pyString(block.tint)},`,
        `            width=${position.width.toFixed(2)},`,
        `            min_height=${index < 4 ? "1.85" : "1.62"},`,
        `            icon=${pyString(block.icon)},`,
        `            eyebrow=${pyString(block.emphasis)},`,
        "        )",
        `        card_${index}.move_to(${toVectorExpression(position.x, position.y)})`,
        `        cards[${pyString(block.id)}] = card_${index}`,
        `        self.add(card_${index})`,
        "",
      ];
    }),
  ];

  const loopConnections =
    plan.connections.filter(
      (connection) =>
        positions.has(connection.fromId) &&
        positions.has(connection.toId) &&
        primaryBlocks.some((block) => block.id === connection.fromId) &&
        primaryBlocks.some((block) => block.id === connection.toId),
    ).slice(0, 4);

  const fallbackLoopConnections =
    primaryBlocks.length === 4
      ? [
        { fromId: primaryBlocks[0].id, toId: primaryBlocks[1].id, label: "1", style: "solid" as const },
        { fromId: primaryBlocks[1].id, toId: primaryBlocks[2].id, label: "2", style: "solid" as const },
        { fromId: primaryBlocks[2].id, toId: primaryBlocks[3].id, label: "3", style: "solid" as const },
        { fromId: primaryBlocks[3].id, toId: primaryBlocks[0].id, label: "4", style: "loop" as const },
      ]
      : [];

  const loopEdges = loopConnections.length >= 3 ? loopConnections : fallbackLoopConnections;

  loopEdges.forEach((connection, index) => {
    const fromPosition = positions.get(connection.fromId)!;
    const toPosition = positions.get(connection.toId)!;
    const curve =
      connection.style === "loop"
        ? 0.9
        : fromPosition.x === 0 || toPosition.x === 0
          ? 0.24
          : -0.24;
    const midX = (fromPosition.x + toPosition.x) / 2;
    const midY = (fromPosition.y + toPosition.y) / 2;

    lines.push(
      `        loop_${index} = connect_cards(`,
      `            cards[${pyString(connection.fromId)}],`,
      `            cards[${pyString(connection.toId)}],`,
      "            palette,",
      "            label='',",
      `            style=${pyString(connection.style)},`,
      `            curve=${curve.toFixed(2)},`,
      "        )",
      `        self.add(loop_${index})`,
      `        step_${index} = make_step_badge(${pyString(String(index + 1))}, palette)`,
      `        step_${index}.move_to(${toVectorExpression(midX, midY + (index % 2 === 0 ? 0.36 : -0.36))})`,
      `        self.add(step_${index})`,
      "",
    );
  });

  plan.callouts.slice(0, 1).forEach((callout, index) => {
    const anchorId = positions.has(callout.anchorId)
      ? callout.anchorId
      : (primaryBlocks[1]?.id ?? primaryBlocks[0]?.id ?? "");
    const anchor = positions.get(anchorId);

    if (!anchor) {
      return;
    }

    const calloutPosition = buildCalloutPosition(
      callout.placement === "left" ? "right" : callout.placement,
      anchor,
    );

    lines.push(
      `        loop_note_${index} = make_callout(`,
      `            ${pyString(compactCopy(callout.title, 5, 28) || "Why the loop helps")},`,
      `            ${pyString(compactCopy(callout.body, 12, 88) || "Each round corrects the previous one")},`,
      "            palette,",
      "            width=2.95,",
      `            icon=${pyString(normalizeInfographicIcon(callout.icon))},`,
      "        )",
      `        loop_note_${index}.move_to(${toVectorExpression(calloutPosition.x, calloutPosition.y)})`,
      `        loop_note_link_${index} = connect_cards(loop_note_${index}, cards[${pyString(anchorId)}], palette, style='dashed', curve=0.12)`,
      `        self.add(loop_note_${index}, loop_note_link_${index})`,
      "",
    );
  });

  return buildSceneShell(plan, lines, {
    titleWidth: 9.4,
    titleShift: "RIGHT * 0.75",
    titleScale: 0.94,
  });
}

function buildComparisonHelpers() {
  return [
    "from manim import *",
    "from infographic_runtime import *",
    "",
    "",
    "def _fit_text(value, font_name, font_size, color, width, weight='MEDIUM', line_spacing=0.95):",
    "    text = Text(' '.join(value.split()), font=font_name, font_size=font_size, color=color, weight=weight, line_spacing=line_spacing)",
    "    if text.width > width:",
    "        text.scale_to_fit_width(width)",
    "    return text",
    "",
    "def _make_pill(text, palette, tint='purple', max_width=1.8):",
    "    label = _fit_text(text, UI_FONT, 15, palette['ink'], max_width - 0.24, weight='MEDIUM')",
    "    box = RoundedRectangle(corner_radius=0.14, width=max(max_width, label.width + 0.26), height=0.42)",
    "    box.set_fill(palette.get(tint, palette['purple']), opacity=1)",
    "    box.set_stroke(palette['ink'], width=2.1)",
    "    label.move_to(box.get_center())",
    "    return VGroup(box, label)",
    "",
    "def _make_mini_box(text, palette, tint='cream', width=0.98, height=0.34):",
    "    rect = RoundedRectangle(corner_radius=0.1, width=width, height=height)",
    "    rect.set_fill(palette.get(tint, palette['cream']), opacity=1)",
    "    rect.set_stroke(palette['ink'], width=1.8)",
    "    label = _fit_text(text, UI_FONT, 13, palette['ink'], width - 0.12, weight='MEDIUM')",
    "    label.move_to(rect.get_center())",
    "    return VGroup(rect, label)",
    "",
    "def _make_variant_card(title, body, accent, icon, tint, mode, palette, width=4.0, height=2.54):",
    "    frame = RoundedRectangle(corner_radius=0.18, width=width, height=height)",
    "    frame.set_fill('#fffaf2', opacity=1)",
    "    frame.set_stroke(palette['ink'], width=2.6)",
    "    title_pill = _make_pill(title, palette, tint=tint, max_width=min(width - 0.52, max(1.55, width * 0.42)))",
    "    title_pill.move_to(frame.get_top() + DOWN * 0.27)",
    "    title_pill.align_to(frame.get_left() + RIGHT * 0.2, LEFT)",
    "    accent_mark = None",
    "    if accent.strip():",
    "        accent_mark = _fit_text(accent, UI_FONT, 13, palette['muted'], width - 0.42, weight='MEDIUM')",
    "        accent_mark.next_to(title_pill, DOWN, buff=0.1, aligned_edge=LEFT)",
    "    query_icon = make_icon('query', color=palette['ink'], size=0.26)",
    "    query_icon.move_to(frame.get_left() + RIGHT * 0.38 + DOWN * 0.08)",
    "    query_label = _fit_text('Query', UI_FONT, 12, palette['ink'], 0.68, weight='MEDIUM')",
    "    query_label.next_to(query_icon, DOWN, buff=0.05)",
    "    core_ring = Circle(radius=0.2, color=palette['ink'], stroke_width=2.3)",
    "    core_ring.set_fill(palette.get(tint, palette['purple']), opacity=0.9)",
    "    core_ring.move_to(frame.get_left() + RIGHT * (width * 0.38) + DOWN * 0.02)",
    "    core_icon = make_icon(icon, color=palette['ink'], size=0.2)",
    "    core_icon.move_to(core_ring.get_center())",
    "    core_label = _fit_text('Retrieve', UI_FONT, 12, palette['ink'], 0.9, weight='MEDIUM')",
    "    core_label.next_to(core_ring, DOWN, buff=0.05)",
    "    docs_icon = make_icon('document', color=palette['ink'], size=0.25)",
    "    docs_icon.move_to(frame.get_right() + LEFT * 0.5 + UP * 0.32)",
    "    docs_label = _fit_text('Sources', UI_FONT, 12, palette['ink'], 0.8, weight='MEDIUM')",
    "    docs_label.next_to(docs_icon, DOWN, buff=0.05)",
    "    db_icon = make_icon('database', color=palette['ink'], size=0.28)",
    "    db_icon.move_to(frame.get_right() + LEFT * 0.45 + DOWN * 0.12)",
    "    db_label = _fit_text('Vector DB', UI_FONT, 12, palette['ink'], 0.9, weight='MEDIUM')",
    "    db_label.next_to(db_icon, DOWN, buff=0.05)",
    "    llm_icon = make_icon('brain', color='#2f9d53', size=0.3)",
    "    llm_icon.move_to(frame.get_bottom() + UP * 0.42 + LEFT * 0.54)",
    "    llm_label = _fit_text('LLM', UI_FONT, 12, palette['ink'], 0.46, weight='MEDIUM')",
    "    llm_label.next_to(llm_icon, UP, buff=0.03)",
    "    prompt_box = _make_mini_box('Prompt', palette, tint='blue', width=0.96, height=0.34)",
    "    prompt_box.move_to(frame.get_bottom() + UP * 0.48 + RIGHT * 0.56)",
    "    output_label = _fit_text('Output', UI_FONT, 12, palette['ink'], 0.8, weight='MEDIUM')",
    "    output_label.move_to(frame.get_bottom() + UP * 0.34 + LEFT * (width * 0.33))",
    "    arrows = VGroup(",
    "        Arrow(query_icon.get_right() + RIGHT * 0.02, core_ring.get_left() + LEFT * 0.01, buff=0.02, stroke_width=2.2, color=palette['ink'], tip_length=0.1, max_stroke_width_to_length_ratio=10),",
    "        Arrow(core_ring.get_right() + RIGHT * 0.02, docs_icon.get_left() + LEFT * 0.02, buff=0.03, stroke_width=2.2, color=palette['ink'], tip_length=0.1, max_stroke_width_to_length_ratio=10),",
    "        Arrow(docs_icon.get_bottom() + DOWN * 0.02, db_icon.get_top() + UP * 0.02, buff=0.03, stroke_width=2.2, color=palette['ink'], tip_length=0.1, max_stroke_width_to_length_ratio=10),",
    "        Arrow(db_icon.get_left() + LEFT * 0.02, prompt_box.get_right() + RIGHT * 0.02, buff=0.03, stroke_width=2.2, color=palette['ink'], tip_length=0.1, max_stroke_width_to_length_ratio=10),",
    "        Arrow(prompt_box.get_left() + LEFT * 0.02, llm_icon.get_right() + RIGHT * 0.02, buff=0.03, stroke_width=2.2, color=palette['ink'], tip_length=0.1, max_stroke_width_to_length_ratio=10),",
    "        Arrow(llm_icon.get_left() + LEFT * 0.05, output_label.get_right() + RIGHT * 0.03, buff=0.03, stroke_width=2.2, color=palette['ink'], tip_length=0.1, max_stroke_width_to_length_ratio=10),",
    "    )",
    "    extras = VGroup()",
    "    if mode == 'multimodal':",
    "        image_icon = make_icon('image', color='#38a6dc', size=0.18).move_to(docs_icon.get_center() + LEFT * 0.24 + UP * 0.18)",
    "        audio_icon = make_icon('audio', color='#f08a2a', size=0.18).move_to(docs_icon.get_center() + RIGHT * 0.22 + UP * 0.18)",
    "        extras.add(image_icon, audio_icon)",
    "    elif mode == 'hypothesis':",
    "        hypo = _make_mini_box('Hypothesis', palette, tint='amber', width=1.1, height=0.34)",
    "        hypo.move_to(core_ring.get_top() + UP * 0.34)",
    "        hypo_link = Arrow(hypo.get_bottom() + DOWN * 0.02, core_ring.get_top() + UP * 0.02, buff=0.02, stroke_width=2.0, color=palette['ink'], tip_length=0.08, max_stroke_width_to_length_ratio=10)",
    "        extras.add(hypo, hypo_link)",
    "    elif mode == 'graph':",
    "        graph_icon = make_icon('graph', color='#6c61c8', size=0.24).move_to(prompt_box.get_center() + RIGHT * 0.68 + DOWN * 0.34)",
    "        graph_label = _fit_text('Graph', UI_FONT, 12, palette['ink'], 0.65, weight='MEDIUM').next_to(graph_icon, DOWN, buff=0.04)",
    "        graph_link = Arrow(db_icon.get_bottom() + DOWN * 0.02, graph_icon.get_top() + UP * 0.02, buff=0.02, stroke_width=2.0, color=palette['ink'], tip_length=0.08, max_stroke_width_to_length_ratio=10)",
    "        extras.add(graph_icon, graph_label, graph_link)",
    "    elif mode == 'router':",
    "        router = _make_mini_box('Route', palette, tint='amber', width=0.84, height=0.32)",
    "        router.move_to(core_ring.get_center() + RIGHT * 0.94 + DOWN * 0.02)",
    "        route_a = Arrow(core_ring.get_right() + RIGHT * 0.02, router.get_left() + LEFT * 0.02, buff=0.02, stroke_width=2.0, color=palette['ink'], tip_length=0.08, max_stroke_width_to_length_ratio=10)",
    "        route_b = Arrow(router.get_right() + RIGHT * 0.02, db_icon.get_left() + LEFT * 0.02, buff=0.02, stroke_width=2.0, color=palette['ink'], tip_length=0.08, max_stroke_width_to_length_ratio=10)",
    "        extras.add(router, route_a, route_b)",
    "    elif mode == 'agent':",
    "        tool_box = _make_mini_box('Tools', palette, tint='green', width=0.84, height=0.32)",
    "        tool_box.move_to(frame.get_right() + LEFT * 0.44 + DOWN * 0.5)",
    "        agent_link = Arrow(llm_icon.get_right() + RIGHT * 0.02, tool_box.get_left() + LEFT * 0.02, buff=0.02, stroke_width=2.0, color=palette['ink'], tip_length=0.08, max_stroke_width_to_length_ratio=10)",
    "        extras.add(tool_box, agent_link)",
    "    elif mode == 'memory':",
    "        memory_icon = make_icon('memory', color='#6c61c8', size=0.22).move_to(core_ring.get_center() + UP * 0.48)",
    "        memory_link = Arrow(memory_icon.get_bottom() + DOWN * 0.02, core_ring.get_top() + UP * 0.02, buff=0.02, stroke_width=2.0, color=palette['ink'], tip_length=0.08, max_stroke_width_to_length_ratio=10)",
    "        extras.add(memory_icon, memory_link)",
    "    summary = _fit_text(body, UI_FONT, 13, palette['ink'], width - 0.38, line_spacing=0.9)",
    "    summary.align_to(frame.get_left() + RIGHT * 0.18, LEFT)",
    "    summary.move_to(frame.get_bottom() + UP * 0.2 + RIGHT * (summary.width * 0.03))",
    "    pieces = [frame, title_pill]",
    "    if accent_mark is not None:",
    "        pieces.append(accent_mark)",
    "    pieces.extend([query_icon, query_label, core_ring, core_icon, core_label, docs_icon, docs_label, db_icon, db_label, llm_icon, llm_label, prompt_box, output_label, arrows, extras, summary])",
    "    group = VGroup(*pieces)",
    "    group.box = frame",
    "    return group",
    "",
    "",
    "class InfographicScene(Scene):",
    "    def construct(self):",
  ];
}

function buildComparisonGridSceneSource(plan: InfographicPlan) {
  const blocks = plan.blocks.map((block) => normalizeSceneBlock(block, plan.visualStyle));
  const positions = buildComparisonPositions(blocks.length);
  const lines = buildComparisonHelpers();

  lines.push(
    `        palette = infographic_palette(${pyString(plan.palette)})`,
    "        self.add(make_paper_background(palette))",
    `        badge = make_section_badge(${pyString(getBadgeText(plan.visualStyle))}, palette)`,
    "        badge.to_edge(LEFT, buff=0.34)",
    "        badge.to_edge(UP, buff=0.28)",
    `        title = make_title_block(${pyString(plan.headline)}, ${pyString(plan.subhead)}, palette, width=10.4)`,
    "        title.to_edge(UP, buff=0.18)",
    "        title.shift(RIGHT * 0.74).scale(0.91)",
    `        footer = make_footer_note(${pyString(plan.footer)}, palette, width=12.0)`,
    "        footer.scale(0.82)",
    "        footer.to_edge(DOWN, buff=0.18)",
    "        self.add(badge, title, footer)",
    "",
  );

  blocks.forEach((block, index) => {
    const position = positions[index]!;
    const tint = index % 4 === 0
      ? "purple"
      : index % 4 === 1
        ? "blue"
        : index % 4 === 2
          ? "green"
          : "amber";

    lines.push(
      `        variant_${index} = _make_variant_card(`,
      `            ${pyString(block.title)},`,
      `            ${pyString(block.body)},`,
      `            ${pyString(block.emphasis)},`,
      `            ${pyString(block.icon)},`,
      `            ${pyString(tint)},`,
      `            ${pyString(block.mode)},`,
      "            palette,",
      `            width=${position.width.toFixed(2)},`,
      "            height=2.28,",
      "        )",
      `        variant_${index}.move_to(${toVectorExpression(position.x, position.y)})`,
      `        self.add(variant_${index})`,
      "",
    );
  });

  if (plan.callouts[0] && blocks.length <= 4) {
    const callout = plan.callouts[0];
    lines.push(
      "        shared_note = make_callout(",
      `            ${pyString(compactCopy(callout.title, 5, 28) || "Shared pattern")},`,
      `            ${pyString(compactCopy(callout.body, 12, 86) || "Compare the step that changes retrieval")},`,
      "            palette,",
      "            width=2.85,",
      `            icon=${pyString(normalizeInfographicIcon(callout.icon))},`,
      "        )",
      "        shared_note.move_to(RIGHT * 5.1 + UP * 1.62)",
      "        self.add(shared_note)",
      "",
    );
  }

  return lines.join("\n");
}

export function buildInfographicSceneSource(input: InfographicSceneInput) {
  const { plan } = input;

  if (plan.visualStyle === "comparison-grid") {
    return buildComparisonGridSceneSource(plan);
  }

  if (plan.visualStyle === "feedback-loop") {
    return buildFeedbackLoopSceneSource(plan);
  }

  if (plan.visualStyle === "flow-map") {
    return buildFlowMapSceneSource(plan);
  }

  return buildArchitectureBoardSceneSource(plan);
}

export function buildFallbackInfographicSceneSource(input: InfographicSceneInput) {
  return buildInfographicSceneSource(input);
}
