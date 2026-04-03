/**
 * Parses an AI message string and extracts dashboard navigation links.
 *
 * Links must be in markdown format: [Label](/dashboard/path)
 * Only /dashboard/* paths are extracted — external URLs are left in the text.
 *
 * @param {string} content - Raw message text from the AI
 * @returns {{ text: string, links: Array<{ label: string, href: string }> }}
 */
export function parseMessageContent(content) {
  const linkRegex = /\[([^\]]+)\]\((\/dashboard[^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({ label: match[1], href: match[2] });
  }
  const text = content.replace(linkRegex, '').trim();
  return { text, links };
}
