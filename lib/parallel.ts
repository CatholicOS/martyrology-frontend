import type { Day } from "@/lib/calendar";
import type { EditionPlacement, ElogiumOut } from "@/lib/types";

/** Every edition's placement of a eulogy, by canonical id, then edition id. A missing id: not fetched yet. */
export type Placements = Record<string, Record<string, EditionPlacement>>;

export interface EulogyRow {
  kind: "eulogy";
  a: ElogiumOut | null;
  b: ElogiumOut | null;
  /** For a one-sided row whose eulogy the other edition prints on this day too (out of order): the row holding it. */
  counterpart: number | null;
}

export type Row = { kind: "titulus" } | EulogyRow | { kind: "conclusio" };

/** What the empty side of a one-sided row says about the eulogy on the other side. */
export type GapNote =
  | { kind: "absent" }
  | { kind: "pending" }
  | { kind: "elsewhere"; day: Day; entry: number | null }
  | { kind: "moved"; direction: "above" | "below"; entry: number | null };

type Side = "a" | "b";

/** The longest common subsequence of two id orders. */
export function lcs(xs: string[], ys: string[]): string[] {
  const t: number[][] = Array.from({ length: xs.length + 1 }, () => new Array<number>(ys.length + 1).fill(0));
  for (let i = xs.length - 1; i >= 0; i--)
    for (let j = ys.length - 1; j >= 0; j--)
      t[i][j] = xs[i] === ys[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: string[] = [];
  for (let i = 0, j = 0; i < xs.length && j < ys.length; ) {
    if (xs[i] === ys[j]) {
      out.push(xs[i]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return out;
}

const idsOf = (xs: ElogiumOut[]) => new Set(xs.flatMap((e) => (e.id ? [e.id] : [])));

/**
 * One day of two editions as rows: the eulogies both print in the same order share a row (the
 * longest common subsequence); every other eulogy has a row of its own, so each side still reads
 * in its own printed order. A B-only row goes after the row holding B's previous eulogy.
 */
export function buildRows(a: ElogiumOut[], b: ElogiumOut[]): Row[] {
  const inA = idsOf(a);
  const inB = idsOf(b);
  const paired = new Set(
    lcs(
      a.flatMap((e) => (e.id && inB.has(e.id) ? [e.id] : [])),
      b.flatMap((e) => (e.id && inA.has(e.id) ? [e.id] : [])),
    ),
  );
  const body: EulogyRow[] = a.map((e) => ({ kind: "eulogy", a: e, b: null, counterpart: null }));
  let after = -1;
  for (const e of b) {
    const i = e.id && paired.has(e.id) ? body.findIndex((r) => r.a?.id === e.id && r.b === null) : -1;
    if (i >= 0) {
      body[i].b = e;
      after = i;
    } else {
      after += 1;
      body.splice(after, 0, { kind: "eulogy", a: null, b: e, counterpart: null });
    }
  }
  const rows: Row[] = [{ kind: "titulus" }, ...body, { kind: "conclusio" }];
  rows.forEach((r, i) => {
    if (r.kind !== "eulogy" || (r.a && r.b)) return;
    const side: Side = r.a ? "a" : "b";
    const other: Side = side === "a" ? "b" : "a";
    const id = r[side]?.id;
    if (!id) return;
    const j = rows.findIndex((x, k) => k !== i && x.kind === "eulogy" && x[other]?.id === id);
    if (j >= 0) r.counterpart = j;
  });
  return rows;
}

/**
 * The note for the empty side of row `index`: where `emptyEdition` prints the eulogy shown on the
 * other side. Null for a paired row, a frame row, or a eulogy without canonical id.
 */
export function gapNote(rows: Row[], index: number, emptyEdition: string, placements: Placements, day: Day): GapNote | null {
  const row = rows[index];
  if (row.kind !== "eulogy" || (row.a && row.b) || (!row.a && !row.b)) return null;
  const empty: Side = row.a ? "b" : "a";
  const id = (row.a ?? row.b)?.id;
  if (!id) return null;
  if (row.counterpart !== null) {
    const there = rows[row.counterpart] as EulogyRow;
    const c = there[empty];
    return { kind: "moved", direction: row.counterpart < index ? "above" : "below", entry: c && !c.unnumbered ? c.entry : null };
  }
  const known = placements[id];
  if (!known) return { kind: "pending" };
  const p = known[emptyEdition];
  if (!p) return { kind: "absent" };
  const [mm, dd] = p.day_printed.split("-").map(Number);
  if (mm === day.mm && dd === day.dd) return null;
  return { kind: "elsewhere", day: { mm, dd }, entry: p.unnumbered ? null : p.entry };
}
