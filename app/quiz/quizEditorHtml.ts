const listBlockPattern = /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const listItemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

function flattenListItems(html: string) {
  const lines: string[] = [];

  html.replace(listItemPattern, (_match, content: string) => {
    lines.push(content.trim());
    return "";
  });

  return lines.join("<br>");
}

export function normalizeQuizEditorHtml(html: string) {
  let normalized = html;
  let previous = "";

  // Repeat so nested lists are flattened from the inside out as well.
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(listBlockPattern, (_match, _tag: string, content: string) =>
      flattenListItems(content)
    );
  }

  return normalized
    .replace(/<\/?li\b[^>]*>/gi, "")
    .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, "")
    .trim();
}
