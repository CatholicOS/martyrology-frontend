import { describe, it, expect } from "vitest";
import type { AddMentionOp, MentionOp, RemoveMentionOp, SetSpanOp } from "@/lib/changeset";
import { contextSegments, contextWords, editedSpan, mentionLang, mentionRanges, wordsIn } from "@/lib/mention-review";

// Invented Latin, never the copyrighted 2004 text.
const context = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.";
const base = { edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text" as const, context, context_start: 120, decision: null };
const add = (extra: Partial<AddMentionOp> = {}): AddMentionOp => ({ ...base, op: "add_mention", id: "a", kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni", ...extra });
const set = (extra: Partial<SetSpanOp> = {}): SetSpanOp => ({ ...base, op: "set_span", id: "s", kind: "person", name: "Fictinus",
  from: { start: 156, end: 163 }, to: { start: 156, end: 172, form: "Fictíni et Ficti" }, ...extra });
const remove = (extra: Partial<RemoveMentionOp> = {}): RemoveMentionOp => ({ ...base, op: "remove_mention", id: "r", kind: "place", start: 120, end: 129, form: "Fictópoli", ...extra });

describe("mentionRanges", () => {
  it("finds each operation's words in the context from context_start", () => {
    expect(mentionRanges(add())).toEqual({ current: null, proposed: { start: 36, end: 43 }, problem: null });
    expect(mentionRanges(set())).toEqual({ current: { start: 36, end: 43 }, proposed: { start: 36, end: 52 }, problem: null });
    expect(mentionRanges(remove())).toEqual({ current: { start: 0, end: 9 }, proposed: null, problem: null });
  });

  it("has nothing proposed for an add_mention without a span", () => {
    expect(mentionRanges(add({ start: null, end: null, form: null }))).toEqual({ current: null, proposed: null, problem: null });
  });

  it("shows a saved edit's words as proposed (a resumed review)", () => {
    const r = mentionRanges(add(), { decision: "edit", edited: { start: 156, end: 172, form: "Fictíni et Ficti" } });
    expect(r).toEqual({ current: null, proposed: { start: 36, end: 52 }, problem: null });
  });

  it("refuses offsets outside the context, marking nothing", () => {
    expect(mentionRanges(add({ context_start: 500 }))).toEqual({ current: null, proposed: null, problem: "outside" });
    expect(mentionRanges(remove({ end: 200 }))).toEqual({ current: null, proposed: null, problem: "outside" });
  });

  it("says when the words at the offsets are not the op's form", () => {
    expect(mentionRanges(add({ form: "Fictinus" })).problem).toBe("changed");
    expect(mentionRanges(remove({ form: "Romæ" })).problem).toBe("changed");
    // An edit is read from the context itself: the curator's words always fit.
    expect(mentionRanges(add({ form: "Fictinus" }), { decision: "edit", edited: { start: 156, end: 163, form: "Fictíni" } }).problem).toBeNull();
  });
});

describe("contextSegments", () => {
  it("cuts the context where either span starts or ends, saying which each piece belongs to", () => {
    expect(contextSegments(context, { start: 36, end: 43 }, { start: 36, end: 52 })).toEqual([
      { text: "Fictópoli in Utópia, natális sancti ", current: false, proposed: false },
      { text: "Fictíni", current: true, proposed: true },
      { text: " et Ficti", current: false, proposed: true },
      { text: ", epíscopi.", current: false, proposed: false },
    ]);
    expect(contextSegments(context, null, null)).toEqual([{ text: context, current: false, proposed: false }]);
  });
});

describe("contextWords, wordsIn and editedSpan", () => {
  const words = contextWords(context);

  it("lists the words with their offsets, without punctuation", () => {
    expect(words.map((w) => w.text)).toEqual(["Fictópoli", "in", "Utópia", "natális", "sancti", "Fictíni", "et", "Ficti", "epíscopi"]);
    expect(words[5]).toEqual({ text: "Fictíni", start: 36, end: 43 });
  });

  it("splits an elided Italian word at its apostrophe", () => {
    expect(contextWords("Ancora a Londra, sant’Oliviero").map((w) => w.text)).toEqual(["Ancora", "a", "Londra", "sant", "Oliviero"]);
  });

  it("does not take a lone hyphen for a word, and keeps a hyphenated name whole", () => {
    expect(contextWords("Fictus - Nemo").map((w) => w.text)).toEqual(["Fictus", "Nemo"]);
    expect(contextWords("sancti Nemónis-Fictíni, epíscopi").map((w) => w.text)).toEqual(["sancti", "Nemónis-Fictíni", "epíscopi"]);
  });

  it("finds the words a range covers", () => {
    expect(wordsIn(words, { start: 36, end: 52 })).toEqual([5, 7]);
    expect(wordsIn(words, null)).toBeNull();
  });

  it("makes an edit from the first word to the last, in either order, in eulogy offsets", () => {
    const op: MentionOp = add();
    expect(editedSpan(op, words, 7, 5)).toEqual({ start: 156, end: 172, form: "Fictíni et Ficti" });
    expect(editedSpan(op, words, 5, 5)).toEqual({ start: 156, end: 163, form: "Fictíni" });
  });
});

describe("mentionLang", () => {
  it("reads the text's language from the edition", () => {
    expect(mentionLang("martyrologium_romanum_2004")).toBe("la");
    expect(mentionLang("martyrologium_romanum_2004_it_IT")).toBe("it");
    expect(mentionLang("martyrologium_romanum_1914_en_unofficial")).toBe("en");
  });
});
