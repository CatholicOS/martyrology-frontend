import { describe, expect, it } from "vitest";
import type { AttachNoteOp, PlaceMarginOp } from "@/lib/changeset";
import {
  anchorProblem,
  attachDecision,
  attachPlace,
  marginDecision,
  marginRef,
  scanImageUrl,
  scanPageUrl,
} from "@/lib/notationes";

const note: AttachNoteOp = {
  op: "attach_note",
  id: "1-11|f",
  class: "no-mark",
  day: "1-11",
  mark: "f",
  lemma: "Leucij Episc",
  note: "Leucij Episc.] Restitutus est ex vet. manuscrip.",
  proposed: { id: "mr:0111-leucius", after: "Episcopi" },
  texts: {
    "mr:0111-leucius": "Brundusij S. Leucij Episcopi & confessoris.",
    "mr:0111-honorata": "Papîæ S. Honoratæ virginis.",
  },
  notes: [],
  scan_page: 64,
  decision: null,
};

const margin: PlaceMarginOp = {
  op: "place_margin",
  id: "48|m|T. 2. A. 885. num. 5.",
  class: "doubt",
  text: "T. 2. A. 885. num. 5.",
  proposed: { note: "1-2|k" },
  candidates: [
    { ref: "1-2|k", kind: "note", lemma: "Danielis", words: "Danielis.] De eodem …" },
    { ref: "mr:0102-isidorus", kind: "eulogy", lemma: null, words: "Item sancti Isidori …" },
  ],
  scan_page: 48,
  image: "https://archive.org/details/bub_gb_2pQUlbrbtAsC/page/n47",
  decision: null,
};

describe("notationes review", () => {
  it("links the scan page and its image (Internet Archive counts pages from n0)", () => {
    expect(scanPageUrl(48)).toBe("https://archive.org/details/bub_gb_2pQUlbrbtAsC/page/n47");
    expect(scanImageUrl(48)).toBe("https://archive.org/download/bub_gb_2pQUlbrbtAsC/page/n47_w1000.jpg");
  });

  it("accepts an anchor found once as whole words, or none", () => {
    const text = note.texts["mr:0111-leucius"];
    expect(anchorProblem(text, "Episcopi")).toBeNull();
    expect(anchorProblem(text, "")).toBeNull();
    expect(anchorProblem(text, "Episc")).toMatch(/not found/);
    expect(anchorProblem("S. Leucij S. Leucij", "Leucij")).toMatch(/2 times/);
  });

  it("records the proposal unchanged as an accept, any change as an edit", () => {
    expect(attachDecision(note, { id: "mr:0111-leucius", after: "Episcopi", mark: "f" })).toEqual({
      decision: "accept",
    });
    expect(attachDecision(note, { id: "mr:0111-honorata", after: "", mark: "g" })).toEqual({
      decision: "edit",
      edited: { id: "mr:0111-honorata", after: null, mark: "g" },
    });
  });

  it("shows a saved edit, a null anchor included", () => {
    expect(attachPlace(note)).toEqual({ id: "mr:0111-leucius", after: "Episcopi", mark: "f" });
    const saved = { decision: "edit" as const, edited: { id: "mr:0111-honorata", after: null, mark: "f" } };
    expect(attachPlace(note, saved)).toEqual({ id: "mr:0111-honorata", after: null, mark: "f" });
  });

  it("places a margin note: the proposal is an accept, a note or eulogy an edit", () => {
    expect(marginDecision(margin, margin.candidates[0])).toEqual({ decision: "accept" });
    expect(marginDecision(margin, margin.candidates[1])).toEqual({
      decision: "edit",
      edited: { id: "mr:0102-isidorus" },
    });
    expect(marginRef(margin)).toBe("1-2|k");
    expect(marginRef(margin, { decision: "edit", edited: { id: "mr:0102-isidorus" } })).toBe("mr:0102-isidorus");
  });
});
