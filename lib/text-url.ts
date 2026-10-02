export type TextPart = { text: string; href?: string };

const URL_RE = /https?:\/\/[^\s<>"]+/g;

/** Split free text into plain and http(s)-link parts; trailing sentence punctuation stays outside the link. */
export function splitUrl(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    const at = m.index;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ text: url, href: url });
    last = at + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
