import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import type { AddMentionOp, DecisionRecord, RemoveMentionOp, SetSpanOp } from "@/lib/changeset";

vi.mock("@/lib/api", () => ({ getElogium: vi.fn(), ApiError: class ApiError extends Error {} }));

// Invented Latin, never the copyrighted 2004 text.
const context = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.";
const base = { edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text" as const, context, context_start: 120, reasoning: "Stem match", decision: null, edited: null };
const ID = "martyrologium_romanum_2004|mr:0101-fictinus|text|156";
const add = (extra: Partial<AddMentionOp> = {}): AddMentionOp => ({ ...base, op: "add_mention", id: ID, kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni", ...extra });
const set = (): SetSpanOp => ({ ...base, op: "set_span", id: ID, kind: "person", name: "Fictinus", from: { start: 156, end: 163 }, to: { start: 156, end: 172, form: "Fictíni et Ficti" } });
const remove = (extra: Partial<RemoveMentionOp> = {}): RemoveMentionOp => ({ ...base, op: "remove_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|120", kind: "place", start: 120, end: 129, form: "Fictópoli", ...extra });

const renderCard = (op: AddMentionOp | SetSpanOp | RemoveMentionOp, decision?: DecisionRecord) => {
  const onDecide = vi.fn();
  const view = render(<OperationCard op={op} decision={decision} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_2004" />);
  return { onDecide, view };
};

describe("MentionCard", () => {
  it("shows an add_mention's passage in the text's language, the proposed words underlined in the person tint", () => {
    const { view } = renderCard(add());
    expect(screen.getByTestId(`op-card-${ID}`)).toBeInTheDocument();
    expect(screen.getByText("Mark these words as a person")).toBeInTheDocument();
    expect(screen.getByText(/in the text/)).toBeInTheDocument();
    const ins = view.container.querySelector("ins")!;
    expect(ins).toHaveTextContent("Fictíni");
    expect(ins.className).toContain("bg-amber-100");
    expect(ins.closest("[lang]")).toHaveAttribute("lang", "la");
    expect(view.container.querySelector("del")).toBeNull();
    expect(screen.getByText("Why: Stem match")).toBeInTheDocument();
  });

  it("shows a set_span's current words struck through and its proposed words underlined", () => {
    const { view } = renderCard(set());
    expect([...view.container.querySelectorAll("ins")].map((e) => e.textContent).join("")).toBe("Fictíni et Ficti");
    expect(view.container.querySelector("del")).toBeNull(); // the current words are inside the proposed ones
    expect(screen.getByText("Move the mark on this person")).toBeInTheDocument();
  });

  it("shows a remove_mention's words struck through in the place tint, with no edit", () => {
    const { view, onDecide } = renderCard(remove());
    const del = view.container.querySelector("del")!;
    expect(del).toHaveTextContent("Fictópoli");
    expect(del.className).toContain("bg-sky-100");
    expect(screen.queryByRole("button", { name: "Choose the words" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onDecide).toHaveBeenCalledWith(remove().id, { decision: "accept" });
  });

  it("accepts and rejects under the op's id", () => {
    const { onDecide } = renderCard(add());
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide.mock.calls).toEqual([[ID, { decision: "accept" }], [ID, { decision: "reject" }]]);
  });

  it("records the words picked last-to-first as an edit, from the first to the last", () => {
    const { onDecide } = renderCard(add());
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    fireEvent.click(screen.getByRole("button", { name: "Ficti" }));
    fireEvent.click(screen.getByRole("button", { name: "Fictíni" }));
    expect(screen.getByText("Chosen: Fictíni et Ficti")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save the words" }));
    expect(onDecide).toHaveBeenCalledWith(ID, { decision: "edit", edited: { start: 156, end: 172, form: "Fictíni et Ficti" } });
  });

  it("cancels an edit without deciding", () => {
    const { onDecide } = renderCard(add());
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose the words" })).toBeInTheDocument();
  });
});

describe("MentionCard, the inputs that reach curators", () => {
  it("asks for the words of an add_mention without a span, and only accepts them as an edit", () => {
    const { view, onDecide } = renderCard(add({ start: null, end: null, form: null }));
    expect(screen.getByText("Not found in the text: choose the words to mark.")).toBeInTheDocument();
    expect(view.container.querySelector("ins")).toBeNull();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    expect(screen.getByRole("button", { name: "Save the words" })).toBeDisabled(); // nothing picked yet
    fireEvent.click(screen.getByRole("button", { name: "Fictíni" }));
    fireEvent.click(screen.getByRole("button", { name: "Save the words" }));
    expect(onDecide).toHaveBeenCalledWith(ID, { decision: "edit", edited: { start: 156, end: 163, form: "Fictíni" } });
  });

  it("warns about offsets outside the context, marks nothing, and only lets the op be rejected", () => {
    const { view, onDecide } = renderCard(add({ context_start: 500 }));
    expect(screen.getByText(/fall outside the quoted text/)).toBeInTheDocument();
    expect(view.container.querySelector("ins, del")).toBeNull();
    expect(screen.getByText(context)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose the words" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).toHaveBeenCalledWith(ID, { decision: "reject" });
  });

  it("warns when the words are no longer the op's form, keeping edit and reject", () => {
    renderCard(add({ form: "Fictinus" }));
    expect(screen.getByText(/no longer has these words/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose the words" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("shows a resumed edit's words as proposed, and picks them again when editing", () => {
    const { view } = renderCard(add(), { decision: "edit", edited: { start: 156, end: 172, form: "Fictíni et Ficti" } });
    expect(screen.getByText("edit")).toBeInTheDocument();
    expect([...view.container.querySelectorAll("ins")].map((e) => e.textContent).join("")).toBe("Fictíni et Ficti");
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    expect(screen.getByText("Chosen: Fictíni et Ficti")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "et" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says which footnote a mention is printed in", () => {
    renderCard(add({ where: { footnote: 2 } }));
    expect(screen.getByText(/in footnote 2/)).toBeInTheDocument();
  });
});
