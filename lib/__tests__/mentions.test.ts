import { describe, it, expect, vi } from "vitest";
import { hasMentions, mentionGroup, mentionKey, mentionQids, mentionsIn, splitByMentions } from "@/lib/mentions";
import type { Mention } from "@/lib/types";

const TEXT = "Cæsaréæ in Cappadócia, sepultúra sancti Basilíi, magístri.";
const place: Mention = { kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338" };
const person: Mention = { kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: null };
const inNote: Mention = { kind: "person", where: { footnote: 2 }, start: 0, end: 5, form: "Petri", name: "Petrus", qid: "Q1" };

describe("mentionKey", () => {
  it("names a mention by its edition, its eulogy, where it is and where it starts", () => {
    expect(mentionKey("ed", "mr:0101-basilius", place)).toBe("ed|mr:0101-basilius|text|0");
    expect(mentionKey("ed", "mr:0101-basilius", inNote)).toBe("ed|mr:0101-basilius|fn2|0");
  });

  it("tells the same mention apart in two editions, as the two columns of a spread", () => {
    expect(mentionKey("a", "mr:x", place)).not.toBe(mentionKey("b", "mr:x", place));
  });
});

describe("mentionsIn", () => {
  it("keeps the text's mentions, sorted, keyed", () => {
    const ms = mentionsIn([person, inNote, place], "text", "ed", "mr:x", TEXT.length);
    expect(ms.map((m) => m.form)).toEqual(["Cæsaréæ in Cappadócia", "Basilíi"]);
    expect(ms[0]).toMatchObject({ key: "ed|mr:x|text|0", eulogy: "mr:x" });
    expect(TEXT.slice(ms[1].start, ms[1].end)).toBe("Basilíi");
  });

  it("keeps a footnote's mentions for that footnote only", () => {
    expect(mentionsIn([place, inNote], 2, "ed", "mr:x", 20).map((m) => m.form)).toEqual(["Petri"]);
    expect(mentionsIn([place, inNote], 1, "ed", "mr:x", 20)).toEqual([]);
  });

  it("drops a mention that does not fit the text", () => {
    const stale: Mention = { ...person, start: 50, end: 90 };
    const empty: Mention = { ...person, start: 5, end: 5 };
    expect(mentionsIn([stale, empty, place], "text", "ed", "mr:x", TEXT.length).map((m) => m.form)).toEqual(["Cæsaréæ in Cappadócia"]);
  });

  it("keeps the first of two overlapping mentions and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inside: Mention = { kind: "person", where: "text", start: 11, end: 21, form: "Cappadócia", name: null, qid: null };
    expect(mentionsIn([place, inside], "text", "ed", "mr:x", TEXT.length).map((m) => m.form)).toEqual(["Cæsaréæ in Cappadócia"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("overlaps"));
    warn.mockRestore();
  });

  it("tolerates a eulogy without mentions (an older API)", () => {
    expect(mentionsIn(undefined, "text", "ed", "mr:x", 10)).toEqual([]);
  });
});

describe("splitByMentions", () => {
  const ms = mentionsIn([place, person], "text", "ed", "mr:x", TEXT.length);

  it("cuts a stretch at the mentions' edges, marking each mention's first piece", () => {
    expect(splitByMentions(0, TEXT.length, ms).map((p) => [p.start, p.end, p.mention?.form ?? null, p.first])).toEqual([
      [0, 21, "Cæsaréæ in Cappadócia", true],
      [21, 40, null, false],
      [40, 47, "Basilíi", true],
      [47, TEXT.length, null, false],
    ]);
  });

  it("gives the part of a mention after a cut point as a later piece of the same mention", () => {
    const after = splitByMentions(7, 30, ms);
    expect(after[0]).toMatchObject({ start: 7, end: 21, first: false });
    expect(after[0].mention?.key).toBe("ed|mr:x|text|0");
  });

  it("returns nothing for an empty stretch", () => {
    expect(splitByMentions(5, 5, ms)).toEqual([]);
  });

  it("never produces an empty piece when two cut points fall at a mention's start", () => {
    const stretches = [[0, 40], [40, 40], [40, TEXT.length]] as const;
    const pieces = stretches.flatMap(([a, b]) => splitByMentions(a, b, ms));
    expect(pieces.every((p) => p.start < p.end)).toBe(true);
    expect(splitByMentions(40, 40, ms)).toEqual([]);
    expect(splitByMentions(44, 44, ms)).toEqual([]); // inside a mention
  });
});

describe("mentionQids", () => {
  it("lists the items a page names, text and footnotes, each once", () => {
    expect(mentionQids([{ mentions: [place, person, inNote] }, null, { mentions: [place] }, {}])).toEqual(["Q1", "Q48338"]);
  });
});

describe("hasMentions", () => {
  it("tells whether a page names anyone or anywhere, footnotes included", () => {
    expect(hasMentions([null, {}, { mentions: [] }])).toBe(false);
    expect(hasMentions([{ mentions: [inNote] }])).toBe(true);
  });
});

describe("mentionGroup", () => {
  const piece = (start: number, end: number, name: string, n?: number) =>
    ({ kind: "person" as const, where: "text" as const, start, end, form: "x", qid: null, name, ...(n ? { n } : {}) });

  it("joins the pieces of one person, apart from another person or another of the same name", () => {
    const g = (m: ReturnType<typeof piece>) => mentionGroup("ed", "mr:0111-petrus-apselamus", m);
    expect(g(piece(20, 25, "Petrus Apselamus"))).toBe(g(piece(39, 47, "Petrus Apselamus")));
    expect(g(piece(20, 25, "Petrus Apselamus"))).not.toBe(g(piece(60, 66, "Ioannes")));
    expect(g(piece(20, 25, "Felix"))).not.toBe(g(piece(40, 45, "Felix", 2)));
  });

  it("joins a place's marks by its item, in both columns of a spread", () => {
    // The Latin and Italian marks of a place carry the same item (crmedr's gazetteer).
    const at = (start: number, qid: string | null) =>
      ({ kind: "place" as const, where: "text" as const, start, end: start + 4, form: "x", qid, name: null });
    expect(mentionGroup("la", "mr:x", at(0, "Q36"))).toBe(mentionGroup("it", "mr:x", at(9, "Q36")));
    expect(mentionGroup("la", "mr:x", at(0, "Q36"))).not.toBe(mentionGroup("la", "mr:x", at(30, "Q181376")));
    expect(mentionGroup("la", "mr:x", at(0, "Q36"))).not.toBe(mentionGroup("la", "mr:y", at(0, "Q36")));
    expect(mentionGroup("la", "mr:x", at(0, "Q36"))).not.toBe(mentionGroup("la", "mr:x", piece(0, 4, "Q36")));
  });

  it("keeps the mark of a place with no item alone", () => {
    const place = { kind: "place" as const, where: "text" as const, start: 0, end: 4, form: "Romæ", qid: null, name: null };
    expect(mentionGroup("ed", "mr:x", place)).toBe(mentionKey("ed", "mr:x", place));
  });

  it("joins a person's marks in the text and in the footnotes, and in both columns of a spread", () => {
    // One person is one name and n in one eulogy, wherever and in whichever edition it is printed: the Italian
    // marks carry the Latin name and n.
    const inNote = { ...piece(0, 5, "Felix"), where: { footnote: 1 } };
    expect(mentionGroup("ed", "mr:x", piece(0, 5, "Felix"))).toBe(mentionGroup("ed", "mr:x", inNote));
    expect(mentionGroup("la", "mr:x", piece(0, 5, "Felix"))).toBe(mentionGroup("it", "mr:x", piece(9, 14, "Felix")));
    expect(mentionGroup("la", "mr:x", piece(0, 5, "Felix"))).not.toBe(mentionGroup("it", "mr:x", piece(9, 14, "Felix", 2)));
    expect(mentionGroup("la", "mr:x", piece(0, 5, "Felix"))).not.toBe(mentionGroup("la", "mr:y", piece(0, 5, "Felix")));
  });
});
