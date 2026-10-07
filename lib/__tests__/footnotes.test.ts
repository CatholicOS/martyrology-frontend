import { describe, it, expect } from "vitest";
import { footnoteOffsets, pageFootnotes } from "@/lib/footnotes";

const fn = (mark: string, after: string | null, text = `Note ${mark}.`) => ({ mark, after, text });

describe("pageFootnotes", () => {
  it("lists a page's printed footnotes in printed order, with their printed marks", () => {
    const notes = pageFootnotes(
      [
        { id: "mr:a", footnotes: [fn("3", "sociorum,")] },
        null,
        { id: "mr:b", footnotes: [] },
        { id: "mr:c", footnotes: [fn("4", "martyrum"), fn("5", "virginum")] },
      ],
      "ed",
    );
    expect(notes.map((n) => [n.id, n.mark, n.at])).toEqual([["mr:a", "3", 0], ["mr:c", "4", 3], ["mr:c", "5", 3]]);
    expect(notes[0]).toMatchObject({ anchor: "fn-ed-mr:a-1", markAnchor: "fn-ed-mr:a-1-mark" });
  });

  it("lists a eulogy printed twice on the page once, at its first printing", () => {
    const e = { id: "mr:a", footnotes: [fn("1", "x")] };
    expect(pageFootnotes([e, e], "ed").map((n) => n.at)).toEqual([0]);
  });

  it("tolerates eulogies without the field (an older API)", () => {
    expect(pageFootnotes([{ id: "mr:a" }], "ed")).toEqual([]);
  });

  it("gives each footnote the margin notes printed beside it, not those beside the eulogy", () => {
    const notes = pageFootnotes(
      [
        {
          id: "mr:a",
          footnotes: [fn("a", "Dominici"), fn("b", "Aristarchi")],
          marginalia: [
            { text: "To.12. An. 1170 n.62.", note: "a" },
            { text: "cir. A. 1170.", note: null },
            { text: "T. 4. An. 45.", note: "a" },
          ],
        },
      ],
      "ed",
    );
    expect(notes.map((n) => n.marginalia)).toEqual([["To.12. An. 1170 n.62.", "T. 4. An. 45."], []]);
  });
});

describe("footnoteOffsets", () => {
  const text = "Tomis, sanctorum Argei et sociorum, martyrum.";
  const place = (after: string | null) =>
    footnoteOffsets(text, pageFootnotes([{ id: "mr:a", footnotes: [fn("1", after)] }], "ed"))[0].at;

  it("sets the mark right after its phrase, as whole words", () => {
    expect(text.slice(0, place("sociorum,"))).toBe("Tomis, sanctorum Argei et sociorum,");
  });

  it("sets it at the end of the eulogy when the phrase is missing, repeated, or null", () => {
    expect(place("sociarum")).toBe(text.length);
    expect(place("orum")).toBe(text.length); // only part of a word
    expect(footnoteOffsets("et et.", pageFootnotes([{ id: "mr:a", footnotes: [fn("1", "et")] }], "ed"))[0].at).toBe(6);
    expect(place(null)).toBe(text.length);
  });

  it("counts overlapping occurrences, as the extractor does, before trusting a phrase", () => {
    const at = footnoteOffsets("et et et.", pageFootnotes([{ id: "mr:a", footnotes: [fn("1", "et et")] }], "ed"))[0].at;
    expect(at).toBe("et et et.".length);
  });

  it("orders marks by position, keeping printed order at the same position", () => {
    const notes = pageFootnotes([{ id: "mr:a", footnotes: [fn("2", null), fn("1", "Argei"), fn("3", null)] }], "ed");
    expect(footnoteOffsets(text, notes).map((m) => m.footnote.mark)).toEqual(["1", "2", "3"]);
  });
});
