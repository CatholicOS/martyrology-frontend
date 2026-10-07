import type { LunaColumn } from "@/lib/types";

/** The heading's bare "Luna." and where it stands: the heading reads "… Luna vigesima." for a year. */
export interface LunaHeading {
  before: string;
  after: string;
}

/**
 * Split a titulus at its bare "Luna" (the last one, with its full stop), so the year's age can be set after it:
 * "Pridie Nonas Augusti. Luna." → before "Pridie Nonas Augusti. ", after "". Null when the heading has none.
 */
export function splitLuna(titulus: string): LunaHeading | null {
  const m = /\bLuna\b\.?/g;
  let last: RegExpExecArray | null = null;
  for (let x = m.exec(titulus); x; x = m.exec(titulus)) last = x;
  if (!last) return null;
  return { before: titulus.slice(0, last.index), after: titulus.slice(last.index + last[0].length) };
}

/** The age announced, without "Luna": "Luna vigesima prima" → "vigesima prima"; the Italian "Luna: 20" → "20". */
export function ageWords(pronuntiatio: string): string {
  return pronuntiatio.replace(/^Luna:?\s+/, "");
}

/** The table in its printed rows (`rows`: their lengths, 17 + 14 in 1630, 19 + 12 in 2004). Each cell keeps its
 * column index. */
export function printedRows(tabula: LunaColumn[], rows: number[] = [17, 14]): { column: number; cell: LunaColumn }[][] {
  const cells = tabula.map((cell, column) => ({ column, cell }));
  const out = [];
  let at = 0;
  for (const n of rows) {
    out.push(cells.slice(at, at + n));
    at += n;
  }
  return out;
}

/** A year a reader may ask for: a whole number the API accepts. */
export function validYear(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null;
}
