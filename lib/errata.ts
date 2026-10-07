import { wholeWordRegExp, type TextSegment } from "@/lib/misprints";
import type { Erratum } from "@/lib/types";

/** "81.20" → "p. 81, l. 20"; "vbique" → "everywhere". */
export function erratumPlace(ref: string): string {
  if (ref === "vbique") return "everywhere";
  const [page, line] = ref.split(".");
  return line ? `p. ${page}, l. ${line}` : `p. ${page}`;
}

/**
 * Split `segments` so each erratum the edition prints for this eulogy is marked in place: a
 * replacement's or deletion's printed phrase becomes its own segment, and an addition gets an
 * empty segment right after the phrase it follows. The API guarantees the phrase occurs exactly
 * once as whole words; one that doesn't (in a run already marked as a misprint) is left unmarked.
 */
export function splitErrata(segments: TextSegment[], errata: Erratum[]): TextSegment[] {
  let out = segments;
  for (const e of errata) {
    const re = wholeWordRegExp(e.printed);
    const hits = out.flatMap((s, i) =>
      s.intended || s.erratum ? [] : [...s.text.matchAll(re)].map((h) => ({ i, at: h.index! })),
    );
    if (hits.length !== 1) continue;
    const { i, at } = hits[0];
    const s = out[i].text;
    const end = at + e.printed.length;
    const parts: TextSegment[] =
      e.kind === "add"
        ? [{ text: s.slice(0, end) }, { text: "", erratum: e }, { text: s.slice(end) }]
        : [{ text: s.slice(0, at) }, { text: e.printed, erratum: e }, { text: s.slice(end) }];
    out = [...out.slice(0, i), ...parts.filter((p) => p.text || p.erratum), ...out.slice(i + 1)];
  }
  return out;
}
