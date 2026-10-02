import snapshot from "@/data/misprints-snapshot.json";

/** A verified misprint in a printed edition (crmedr data/misprints.json). */
export interface Misprint {
  id: string;
  edition: string;
  printed: string;
  intended: string;
}

/** A run of eulogy text; `intended` is set on the run that is the misprint itself. */
export interface TextSegment {
  text: string;
  intended?: string;
}

const MISPRINTS = snapshot as Misprint[];

export function misprintsFor(edition: string, id: string | null, all: Misprint[] = MISPRINTS): Misprint[] {
  if (!id) return [];
  return all.filter((m) => m.edition === edition && m.id === id);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split `text` so each misprint's printed phrase is its own segment. crmedr
 * guarantees the phrase occurs exactly once as whole words; one that doesn't
 * (e.g. the text was corrected upstream) is left unmarked.
 */
export function splitMisprints(text: string, misprints: Misprint[]): TextSegment[] {
  let segments: TextSegment[] = [{ text }];
  for (const m of misprints) {
    const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(m.printed)}(?![\\p{L}\\p{M}\\p{N}])`, "gu");
    const hits = segments.flatMap((s, i) => (s.intended ? [] : [...s.text.matchAll(re)].map((h) => ({ i, h }))));
    if (hits.length !== 1) continue;
    const { i, h } = hits[0];
    const s = segments[i].text;
    const at = h.index!;
    const parts: TextSegment[] = [
      { text: s.slice(0, at) },
      { text: m.printed, intended: m.intended },
      { text: s.slice(at + m.printed.length) },
    ].filter((p) => p.text);
    segments = [...segments.slice(0, i), ...parts, ...segments.slice(i + 1)];
  }
  return segments;
}
