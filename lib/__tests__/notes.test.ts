import { describe, it, expect } from "vitest";
import { pageNotes } from "@/lib/notes";

const all = { "mr:0220-a": { note: "First." }, "mr:0220-c": { note: "Second." }, "mr:0220-d": { note: "Third." } };

describe("pageNotes", () => {
  it("marks a page's notes †, ††, ††† in the order their eulogies are printed", () => {
    const notes = pageNotes(["mr:0220-c", null, "mr:0220-b", "mr:0220-a", "mr:0220-d"], "ed", all);
    expect(notes.map((n) => [n.id, n.mark, n.note])).toEqual([
      ["mr:0220-c", "†", "Second."], ["mr:0220-a", "††", "First."], ["mr:0220-d", "†††", "Third."],
    ]);
  });

  it("anchors each note per edition, with its mark's anchor for the link back", () => {
    expect(pageNotes(["mr:0220-a"], "martyrologium_romanum_1749", all)[0]).toMatchObject({
      anchor: "note-martyrologium_romanum_1749-mr:0220-a",
      markAnchor: "note-martyrologium_romanum_1749-mr:0220-a-mark",
    });
  });

  it("notes a eulogy printed twice on the page once, at its first printing", () => {
    const notes = pageNotes([null, "mr:0220-a", "mr:0220-a"], "ed", all);
    expect(notes).toHaveLength(1);
    expect(notes[0].at).toBe(1);
  });

  it("adds a note on one edition's text only on that edition's pages", () => {
    const scoped = {
      "mr:0127-x": { editions: { martyrologium_romanum_1914_en_unofficial: "Translation error." } },
      "mr:0625-y": { note: "About the eulogy.", editions: { martyrologium_romanum_1749: "This print errs." } },
    };
    expect(pageNotes(["mr:0127-x"], "martyrologium_romanum_2004", scoped)).toEqual([]);
    expect(pageNotes(["mr:0127-x"], "martyrologium_romanum_1914_en_unofficial", scoped)[0].note).toBe("Translation error.");
    expect(pageNotes(["mr:0625-y"], "martyrologium_romanum_1749", scoped)[0].note).toBe("About the eulogy. This print errs.");
    expect(pageNotes(["mr:0625-y"], "martyrologium_romanum_2004", scoped)[0].note).toBe("About the eulogy.");
  });

  it("reads the registry's notes by default", () => {
    expect(pageNotes(["mr:0220-eleutherius-et-socii"], "ed")[0].note).toMatch(/mr:0218-sadoth-et-socii/);
  });
});
