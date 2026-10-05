import { getSnapshot, type RegistrySnapshot } from "@/lib/snapshot";
import type { TextPart } from "@/lib/text-url";

const ID_RE = /\bmr:\d{4}-[a-z]+(?:-[a-z]+)*/g;
const LATIN_2004 = "martyrologium_romanum_2004";

/**
 * Split a curator's note into text and links, one link per registry ID it names: to the
 * eulogy's day in the page's edition (`#<id>` makes the reader find it there). A deprecated ID
 * is not in the 2004 editions, so from a 2004 page it opens in the edition it is attested in.
 * An ID the registry does not know stays plain text.
 */
export function noteParts(text: string, edition: string, snap: RegistrySnapshot = getSnapshot()): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(ID_RE)) {
    const id = m[0];
    const e = snap[id];
    if (!e) continue;
    const page = edition || LATIN_2004;
    const target = e.deprecated && page.startsWith(LATIN_2004) ? (e.attested_in ?? page) : page;
    const mm = id.slice(3, 5);
    const dd = id.slice(5, 7);
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: id, href: `/read/${encodeURIComponent(target)}/${mm}/${dd}#${id}` });
    last = m.index + id.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
