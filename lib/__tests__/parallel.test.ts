import { describe, it, expect } from "vitest";
import { buildRows, gapNote, lcs, type EulogyRow, type Placements, type Row } from "@/lib/parallel";
import type { ElogiumOut } from "@/lib/types";

const el = (id: string | null, entry: number | null = 1, unnumbered = false): ElogiumOut => ({
  id, entry, asterisk: false, unnumbered, anchor_day: "10-04", text: `text of ${id}`,
});
const ids = (rows: Row[]) =>
  rows.map((r) => (r.kind === "eulogy" ? `${r.a?.id ?? "-"}|${r.b?.id ?? "-"}` : r.kind));
const DAY = { mm: 10, dd: 4 };
const B = "martyrologium_romanum_1749";

describe("lcs", () => {
  it("keeps the longest run common to both orders", () => {
    expect(lcs(["x", "y", "z"], ["x", "z"])).toEqual(["x", "z"]);
    expect(lcs(["x", "y"], ["y", "x"])).toHaveLength(1);
    expect(lcs([], ["x"])).toEqual([]);
  });
});

describe("buildRows", () => {
  it("pairs every eulogy of identical days, between titulus and conclusio", () => {
    expect(ids(buildRows([el("x"), el("y")], [el("x"), el("y")]))).toEqual(["titulus", "x|x", "y|y", "conclusio"]);
  });

  it("puts a B-only eulogy after the row holding B's previous eulogy", () => {
    expect(ids(buildRows([el("x"), el("y")], [el("x"), el("z"), el("y")]))).toEqual(["titulus", "x|x", "-|z", "y|y", "conclusio"]);
  });

  it("puts a B-only eulogy first when it is B's first", () => {
    expect(ids(buildRows([el("x")], [el("z"), el("x")]))).toEqual(["titulus", "-|z", "x|x", "conclusio"]);
  });

  it("keeps A-only eulogies in A's order", () => {
    expect(ids(buildRows([el("x"), el("w"), el("y")], [el("x"), el("y")]))).toEqual(["titulus", "x|x", "w|-", "y|y", "conclusio"]);
  });

  it("leaves a reordered eulogy unpaired, pointing each side at the other's row", () => {
    const rows = buildRows([el("x"), el("y")], [el("y"), el("x")]);
    expect(ids(rows)).toEqual(["titulus", "x|-", "y|y", "-|x", "conclusio"]);
    expect((rows[1] as EulogyRow).counterpart).toBe(3);
    expect((rows[3] as EulogyRow).counterpart).toBe(1);
  });

  it("gives a second copy of the same eulogy its own row", () => {
    expect(ids(buildRows([el("x"), el("x")], [el("x")]))).toEqual(["titulus", "x|x", "x|-", "conclusio"]);
  });

  it("keeps each side in its printed order when an id repeats", () => {
    const rows = buildRows([el("x"), el("y"), el("x")], [el("x"), el("x"), el("y")]);
    const col = (side: "a" | "b") => rows.flatMap((r) => (r.kind === "eulogy" && r[side] ? [r[side]!.id] : []));
    expect(col("b")).toEqual(["x", "x", "y"]);
    expect(col("a")).toEqual(["x", "y", "x"]);
    const back = buildRows([el("x"), el("x"), el("y")], [el("x"), el("y"), el("x")]);
    expect(back.flatMap((r) => (r.kind === "eulogy" && r.b ? [r.b.id] : []))).toEqual(["x", "y", "x"]);
  });

  it("does not point a second copy at a row that is already paired", () => {
    const rows = buildRows([el("x"), el("x")], [el("x")]);
    expect((rows[2] as EulogyRow).counterpart).toBeNull();
    expect(gapNote(rows, 2, B, {}, DAY)).toEqual({ kind: "pending" });
  });

  it("frames an empty side with titulus and conclusio", () => {
    expect(ids(buildRows([el("x"), el("y")], []))).toEqual(["titulus", "x|-", "y|-", "conclusio"]);
  });

  it("never pairs eulogies without a canonical id", () => {
    // ids() prints a missing id as "-": an A row and a B row, each one-sided.
    expect(ids(buildRows([el(null)], [el(null)]))).toEqual(["titulus", "-|-", "-|-", "conclusio"]);
  });
});

describe("gapNote", () => {
  const rows = buildRows([el("x"), el("w", 5)], [el("x")]);
  const w = 2; // row of the A-only eulogy w

  it("is pending until the placements arrive", () => {
    expect(gapNote(rows, w, B, {}, DAY)).toEqual({ kind: "pending" });
  });

  it("says absent when the other edition does not print it", () => {
    const p: Placements = { w: { other: { day_printed: "10-04", entry: 5, asterisk: false, unnumbered: false, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toEqual({ kind: "absent" });
  });

  it("names the other day and entry when printed elsewhere", () => {
    const p: Placements = { w: { [B]: { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toEqual({ kind: "elsewhere", day: { mm: 10, dd: 5 }, entry: 3 });
  });

  it("drops the entry of an unnumbered placement", () => {
    const p: Placements = { w: { [B]: { day_printed: "10-05", entry: 1, asterisk: false, unnumbered: true, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toEqual({ kind: "elsewhere", day: { mm: 10, dd: 5 }, entry: null });
  });

  it("says above or below for a eulogy printed on this day out of order", () => {
    const r = buildRows([el("x", 1), el("y", 2)], [el("y", 6), el("x", 7)]);
    expect(gapNote(r, 1, B, {}, DAY)).toEqual({ kind: "moved", direction: "below", entry: 7 });
    expect(gapNote(r, 3, "a-edition", {}, DAY)).toEqual({ kind: "moved", direction: "above", entry: 1 });
  });

  it("notes the empty A side of a B-only row", () => {
    const r = buildRows([el("x")], [el("x"), el("z", 9)]);
    expect(gapNote(r, 2, "a-edition", {}, DAY)).toEqual({ kind: "pending" });
    const p: Placements = { z: { "a-edition": { day_printed: "10-06", entry: 2, asterisk: false, unnumbered: false, text: null } } };
    expect(gapNote(r, 2, "a-edition", p, DAY)).toEqual({ kind: "elsewhere", day: { mm: 10, dd: 6 }, entry: 2 });
  });

  it("has no note when the placement is on this very day", () => {
    const p: Placements = { w: { [B]: { day_printed: "10-04", entry: 5, asterisk: false, unnumbered: false, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toBeNull();
  });

  it("has no note for a paired row, a frame row, or a eulogy without id", () => {
    expect(gapNote(rows, 1, B, {}, DAY)).toBeNull();
    expect(gapNote(rows, 0, B, {}, DAY)).toBeNull();
    const r = buildRows([el(null)], []);
    expect(gapNote(r, 1, B, {}, DAY)).toBeNull();
  });
});
