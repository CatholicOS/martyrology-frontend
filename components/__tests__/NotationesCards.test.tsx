import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OperationCard from "@/components/OperationCard";
import type { AttachNoteOp, PlaceMarginOp } from "@/lib/changeset";

vi.mock("@/lib/api", () => ({ getElogium: vi.fn(), ApiError: class extends Error {} }));

const texts = {
  "mr:0111-leucius": "Brundusij S. Leucij Episcopi & confessoris.",
  "mr:0111-honorata": "Papîæ S. Honoratæ virginis.",
};

const note: AttachNoteOp = {
  op: "attach_note",
  id: "1-11|f",
  class: "no-mark",
  day: "1-11",
  mark: "f",
  lemma: "Leucij Episc",
  note: "Leucij Episc.] Restitutus est ex vet. manuscrip.",
  proposed: { id: "mr:0111-leucius", after: "Episcopi" },
  texts,
  notes: [
    { ref: "1-11|e", mark: "e", lemma: "Palæmonis" },
    { ref: "1-11|f", mark: "f", lemma: "Leucij Episc" },
  ],
  scan_page: 64,
  decision: null,
};

const mark: AttachNoteOp = {
  ...note,
  id: "1-11|g",
  uid: "1-11|g|mark",
  class: "mark-without-note",
  mark: "g",
  lemma: null,
  note: null,
};

const margin: PlaceMarginOp = {
  op: "place_margin",
  id: "48|m|T. 2. A. 885. num. 5.",
  class: "doubt",
  confidence: "medium",
  reasoning: "Left margin, lower in note k.",
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

const renderCard = (op: AttachNoteOp | PlaceMarginOp, onDecide = vi.fn()) => {
  render(<OperationCard op={op} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_1630" />);
  return onDecide;
};

describe("AttachNoteCard", () => {
  it("shows why it is listed, the note, and the eulogy with the letter after its anchor", () => {
    renderCard(note);
    expect(screen.getByText(/placed by the words of its lemma/)).toBeInTheDocument();
    expect(screen.getByText(/Restitutus est/)).toBeInTheDocument();
    const placed = screen.getByRole("link", { name: "Footnote f" });
    expect(placed.parentElement?.textContent).toBe("Brundusij S. Leucij Episcopif & confessoris.");
    expect(screen.getByRole("link", { name: "Scan page 64" })).toHaveAttribute(
      "href",
      "https://archive.org/details/bub_gb_2pQUlbrbtAsC/page/n63"
    );
  });

  it("accepts and rejects", () => {
    const onDecide = renderCard(note);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onDecide).toHaveBeenLastCalledWith("1-11|f", { decision: "accept" });
    fireEvent.click(screen.getByRole("button", { name: "Not a note of this day" }));
    expect(onDecide).toHaveBeenLastCalledWith("1-11|f", { decision: "reject" });
  });

  it("edits the eulogy, anchor and letter, refusing an anchor not found once", () => {
    const onDecide = renderCard(note);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("eulogy"), { target: { value: "mr:0111-honorata" } });
    fireEvent.change(screen.getByLabelText("after"), { target: { value: "Honorat" } });
    expect(screen.getByText(/not found as whole words/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save edit" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("after"), { target: { value: "Honoratæ" } });
    fireEvent.change(screen.getByLabelText("letter"), { target: { value: "g" } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenCalledWith("1-11|f", {
      decision: "edit",
      edited: { id: "mr:0111-honorata", after: "Honoratæ", mark: "g" },
    });
  });

  it("a letter without a note: missing from the book, or one of the day's notes", () => {
    const onDecide = renderCard(mark);
    expect(screen.getByText(/with no note found/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Missing from the book" }));
    expect(onDecide).toHaveBeenLastCalledWith("1-11|g|mark", { decision: "accept" });
    fireEvent.change(screen.getByLabelText(/the day’s note/), { target: { value: "1-11|f" } });
    fireEvent.click(screen.getByRole("button", { name: "Give it this note" }));
    expect(onDecide).toHaveBeenLastCalledWith("1-11|g|mark", { decision: "edit", edited: { note: "1-11|f" } });
    fireEvent.click(screen.getByRole("button", { name: "Not a reference letter" }));
    expect(onDecide).toHaveBeenLastCalledWith("1-11|g|mark", { decision: "reject" });
  });
});

describe("PlaceMarginCard", () => {
  it("records decisions under the op's uid when it has one", () => {
    const onDecide = renderCard({ ...margin, uid: "48|m|x" });
    fireEvent.click(screen.getByRole("button", { name: "Not a margin note" }));
    expect(onDecide).toHaveBeenLastCalledWith("48|m|x", { decision: "reject" });
  });

  it("shows the margin note, the reviewer's comment, the candidates and the page image", () => {
    renderCard(margin);
    expect(screen.getAllByText("T. 2. A. 885. num. 5.").length).toBeGreaterThan(0);
    expect(screen.getByText("Reviewer: Left margin, lower in note k.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Scan page 48" })).toHaveAttribute(
      "src",
      "https://archive.org/download/bub_gb_2pQUlbrbtAsC/page/n47_w1000.jpg"
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("accepts the proposal, edits to another candidate, rejects", () => {
    const onDecide = renderCard(margin);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onDecide).toHaveBeenLastCalledWith(margin.id, { decision: "accept" });
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Accept (edited)" }));
    expect(onDecide).toHaveBeenLastCalledWith(margin.id, { decision: "edit", edited: { id: "mr:0102-isidorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Not a margin note" }));
    expect(onDecide).toHaveBeenLastCalledWith(margin.id, { decision: "reject" });
  });
});
