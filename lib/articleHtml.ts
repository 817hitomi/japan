const EMPTY_BLOCK_START = /^\s*<(p|div)(?:\s[^>]*)?>\s*(?:(?:<br\s*\/?\s*>|&nbsp;|&#160;|\u00a0)\s*)*<\/\1>\s*/i;
const EMPTY_BLOCK_END = /\s*<(p|div)(?:\s[^>]*)?>\s*(?:(?:<br\s*\/?\s*>|&nbsp;|&#160;|\u00a0)\s*)*<\/\1>\s*$/i;

/**
 * Contenteditable inserts empty paragraphs around pasted or split content.
 * Keep intentional spacing inside the article, but do not render/save empty
 * paragraphs at the beginning or end of a block.
 */
export function trimBoundaryEmptyBlocks(html: string) {
  let trimmed = html.trim();
  let previous = "";

  while (trimmed !== previous) {
    previous = trimmed;
    trimmed = trimmed.replace(EMPTY_BLOCK_START, "").replace(EMPTY_BLOCK_END, "").trim();
  }

  return trimmed;
}

export function hasMeaningfulArticleHtml(html: string) {
  const withoutTags = html
    .replace(/<br\s*\/?\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();

  return Boolean(withoutTags || /<(?:img|video|iframe|hr|li)\b/i.test(html));
}
