import { describe, it, expect } from "vitest";
import { eulogyMisprintsFor, footnoteMisprintsFor, misprintsFor, splitMisprints, type Misprint } from "@/lib/misprints";

const LA = "martyrologium_romanum_2004";
const IT = "martyrologium_romanum_2004_it_IT";
const m = (id: string, edition: string, printed: string, intended: string): Misprint => ({ id, edition, printed, intended });

describe("misprintsFor", () => {
  const all = [m("mr:a", LA, "x", "y"), m("mr:a", IT, "p", "q"), m("mr:b", LA, "z", "w")];

  it("selects by edition and id", () => {
    expect(misprintsFor(LA, "mr:a", all)).toEqual([all[0]]);
    expect(misprintsFor(IT, "mr:b", all)).toEqual([]);
    expect(misprintsFor(LA, null, all)).toEqual([]);
  });

  it("leaves out the misprints of the eulogy's footnotes, which footnoteMisprintsFor gives by footnote", () => {
    const inNote = { ...m("mr:a", IT, "e maria", "e Maria"), footnote: 1 };
    const withNote = [...all, inNote];
    expect(misprintsFor(IT, "mr:a", withNote)).toEqual([all[1]]);
    expect(footnoteMisprintsFor(IT, "mr:a", 1, withNote)).toEqual([inNote]);
    expect(footnoteMisprintsFor(IT, "mr:a", 2, withNote)).toEqual([]);
    expect(footnoteMisprintsFor(LA, "mr:a", 1, withNote)).toEqual([]);
  });

  it("eulogyMisprintsFor gives them all: the text's, then the footnotes' in footnote order", () => {
    const note2 = { ...m("mr:a", IT, "b", "c"), footnote: 2 };
    const note1 = { ...m("mr:a", IT, "e maria", "e Maria"), footnote: 1 };
    expect(eulogyMisprintsFor(IT, "mr:a", [note2, ...all, note1])).toEqual([all[1], note1, note2]);
  });

  it("reads the bundled snapshot by default", () => {
    expect(misprintsFor(IT, "mr:0305-phoca")).toEqual([m("mr:0305-phoca", IT, "nell’odiena", "nell’odierna")]);
  });
});

describe("splitMisprints", () => {
  it("isolates the misprinted phrase", () => {
    expect(splitMisprints("Martiri un Inghilterra sotto Elisabetta.", [m("mr:a", IT, "un Inghilterra", "in Inghilterra")])).toEqual([
      { text: "Martiri " },
      { text: "un Inghilterra", intended: "in Inghilterra" },
      { text: " sotto Elisabetta." },
    ]);
  });

  it("matches whole words only, including accented letters", () => {
    const mp = [m("mr:a", IT, "Mel", "Nel")];
    expect(splitMisprints("Melito. Mel territorio.", mp)).toEqual([
      { text: "Melito. " },
      { text: "Mel", intended: "Nel" },
      { text: " territorio." },
    ]);
    expect(splitMisprints("Ménel", [m("mr:a", LA, "nel", "x")])).toEqual([{ text: "Ménel" }]);
  });

  it("treats combining marks as part of a word (decomposed accents)", () => {
    const mp = [m("mr:a", IT, "Mel", "Nel")];
    expect(splitMisprints("E\u0301Mel", mp)).toEqual([{ text: "E\u0301Mel" }]);
    expect(splitMisprints("Mel\u0301", mp)).toEqual([{ text: "Mel\u0301" }]);
  });

  it("marks the phrase at the end of the text", () => {
    expect(splitMisprints("in Bellrreguart", [m("mr:a", LA, "Bellrreguart", "Bellreguart")])).toEqual([
      { text: "in " },
      { text: "Bellrreguart", intended: "Bellreguart" },
    ]);
  });

  it("leaves the text unmarked when the phrase is missing or ambiguous", () => {
    const mp = [m("mr:a", LA, "abc", "abd")];
    expect(splitMisprints("nothing here", mp)).toEqual([{ text: "nothing here" }]);
    expect(splitMisprints("abc and abc", mp)).toEqual([{ text: "abc and abc" }]);
  });

  it("handles several misprints in one text", () => {
    const mp = [m("mr:a", LA, "aa", "a"), m("mr:a", LA, "bb", "b")];
    expect(splitMisprints("x aa y bb z", mp)).toEqual([
      { text: "x " }, { text: "aa", intended: "a" }, { text: " y " }, { text: "bb", intended: "b" }, { text: " z" },
    ]);
  });
});
