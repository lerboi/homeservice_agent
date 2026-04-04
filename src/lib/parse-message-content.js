/**
 * Parses an AI message string and extracts navigation links.
 *
 * Links must be in markdown format: [Label](/path)
 * By default only /dashboard/* paths are extracted.
 * Pass a custom linkPattern to extract different routes.
 *
 * @param {string} content - Raw message text from the AI
 * @param {RegExp} [linkPattern] - Custom regex with (label) and (href) capture groups
 * @returns {{ text: string, links: Array<{ label: string, href: string }> }}
 */
export function parseMessageContent(content, linkPattern) {
  const linkRegex = linkPattern || /\[([^\]]+)\]\((\/dashboard[^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({ label: match[1], href: match[2] });
  }
  const text = content.replace(linkRegex, '').trim();
  return { text, links };
}
