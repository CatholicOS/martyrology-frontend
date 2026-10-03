import { wholeWordRegExp } from "@/lib/misprints";
import type { ElogiumOut, Footnote } from "@/lib/types";

/** A printed footnote placed on a page. */
export interface PageFootnote extends Footnote {
  id: string;
  /** Where its eulogy first comes in the page's list: only that printing carries the mark. */
  at: number;
  /** The footnote's element id. */
  anchor: string;
  /** The element id of its mark in the text, for the link back. */
  markAnchor: string;
}

/**
 * The printed footnotes of a page's eulogies, in printed order, with their printed marks.
 * `edition` keeps the anchors apart when two sheets face each other.
 */
export function pageFootnotes(elogia: (Pick<ElogiumOut, "id" | "footnotes"> | null)[], edition: string): PageFootnote[] {
  const seen = new Set<string>();
  const out: PageFootnote[] = [];
  elogia.forEach((e, at) => {
    if (!e?.id || seen.has(e.id) || !e.footnotes?.length) return;
    const id = e.id;
    seen.add(id);
    e.footnotes.forEach((f, k) => {
      const anchor = `fn-${edition}-${id}-${k + 1}`;
      out.push({ ...f, id, at, anchor, markAnchor: `${anchor}-mark` });
    });
  });
  return out;
}

/** Where `phrase` starts in `text` as whole words, overlapping occurrences included (as the extractor counts). */
function occurrences(text: string, phrase: string): number[] {
  const re = wholeWordRegExp(phrase);
  const starts: number[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    starts.push(m.index);
    re.lastIndex = m.index + 1;
  }
  return starts;
}

/**
 * Where each footnote's mark goes in `text`: right after its phrase when the phrase occurs exactly
 * once as whole words, otherwise at the end of the eulogy. Sorted by position, printed order kept.
 */
export function footnoteOffsets(text: string, footnotes: PageFootnote[]): { at: number; footnote: PageFootnote }[] {
  return footnotes
    .map((footnote, i) => {
      const hits = footnote.after ? occurrences(text, footnote.after) : [];
      const at = hits.length === 1 ? hits[0] + footnote.after!.length : text.length;
      return { at, footnote, i };
    })
    .sort((x, y) => x.at - y.at || x.i - y.i)
    .map(({ at, footnote }) => ({ at, footnote }));
}
