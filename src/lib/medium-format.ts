function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function formatInlineMarkdown(text: string) {
  const placeholders: string[] = [];

  function stash(value: string) {
    const token = `__HTML_TOKEN_${placeholders.length}__`;
    placeholders.push(value);
    return token;
  }

  let formatted = escapeHtml(text);

  formatted = formatted.replace(/`([^`]+)`/g, (_, code: string) =>
    stash(`<code>${code}</code>`),
  );

  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label: string, href: string) =>
      stash(
        `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${label}</a>`,
      ),
  );

  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return placeholders.reduce(
    (value, html, index) => value.replace(`__HTML_TOKEN_${index}__`, html),
    formatted,
  );
}

function isOrderedListItem(line: string) {
  return /^\d+\.\s+/.test(line);
}

function isUnorderedListItem(line: string) {
  return /^[-*]\s+/.test(line);
}

function isBlockStart(line: string) {
  return (
    line.startsWith("```") ||
    /^#{1,3}\s+/.test(line) ||
    line.startsWith(">") ||
    isOrderedListItem(line) ||
    isUnorderedListItem(line)
  );
}

export function renderMediumMarkdown(markdown: string) {
  const lines = markdown.trim().replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const currentLine = lines[index];
    const trimmed = currentLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const codeClass = language
        ? ` class="language-${escapeAttribute(language)}"`
        : "";
      const languageAttribute = language
        ? ` data-language="${escapeAttribute(language)}"`
        : "";

      blocks.push(
        `<pre${languageAttribute}><code${codeClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = `h${level}`;
      blocks.push(`<${tag}>${formatInlineMarkdown(headingMatch[2])}</${tag}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(
        `<blockquote><p>${quoteLines
          .map((line) => formatInlineMarkdown(line))
          .join("<br />")}</p></blockquote>`,
      );
      continue;
    }

    if (isUnorderedListItem(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && isUnorderedListItem(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ul>${items
          .map((item) => `<li>${formatInlineMarkdown(item)}</li>`)
          .join("")}</ul>`,
      );
      continue;
    }

    if (isOrderedListItem(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && isOrderedListItem(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ol>${items
          .map((item) => `<li>${formatInlineMarkdown(item)}</li>`)
          .join("")}</ol>`,
      );
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        break;
      }

      if (isBlockStart(line.trim()) && paragraphLines.length > 0) {
        break;
      }

      paragraphLines.push(line.trim());
      index += 1;
    }

    blocks.push(`<p>${formatInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}
