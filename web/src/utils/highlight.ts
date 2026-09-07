export const escapeHTML = (text: string): string => text.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

export function highlightMatches(text: string, indices?: ReadonlyArray<readonly [number, number]>): string {
  let result = '';
  let position = 0;
  for (const [start, end] of [...(indices ?? [])].sort((a, b) => a[0] - b[0])) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < position || end < start || end >= text.length) continue;
    result += escapeHTML(text.slice(position, start));
    result += `<mark>${escapeHTML(text.slice(start, end + 1))}</mark>`;
    position = end + 1;
  }
  return result + escapeHTML(text.slice(position));
}
