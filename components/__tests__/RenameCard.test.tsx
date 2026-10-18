import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import type { RenameJev, RenameOp } from "@/lib/changeset";

vi.mock("@/components/EulogyView", () => ({ default: () => <div data-testid="eulogy" /> }));

const op: RenameOp = {
  op: "rename",
  id: "mr:0101-eugendus",
  new_id: "mr:0101-eugendus-abbas",
  uid: "subject:mr:0101-eugendus",
  subject_la: "Sanctus Eugendus Abbas",
  class: "bare",
  confidence: "medium",
  decision: null,
  candidates: [
    { new_id: "mr:0101-eugendus-abbas", category: "role-place", weak: false, labels: { la: "Sanctus Eugendus Abbas", en: null, it: "Sant'Eugendo abate" }, basis: "bare-name draft" },
    { new_id: "mr:0101-eugendus-condatiscensis", category: "place-adjective", weak: true, certain: false, labels: { la: "Sanctus Eugendus Condatiscensis", en: "Eugendus of Condat", it: null }, basis: "place in the record" },
    { new_id: "mr:0101-eugendus-condati", category: "place-genitive", weak: false, labels: { la: "Sanctus Eugendus Condati", en: "x", it: "y" }, basis: "genitive" },
  ],
};
const props = { locale: "la" as const, baseEdition: "martyrologium_romanum_1749" };
const withJev = (jev: RenameJev): RenameOp => ({ ...op, jev });
const EDIT = { decision: "edit", edited: { new_id: "mr:0101-eugendus-condatiscensis", subject_la: "Sanctus Eugendus Condatiscensis" } };

describe("RenameCard", () => {
  it("lists candidates with chips and the draft badge; null labels read as a dash", () => {
    render(<OperationCard op={op} onDecide={vi.fn()} {...props} />);
    expect(screen.getByText("role and place")).toBeInTheDocument();
    expect(screen.getByText("place (adjective)")).toBeInTheDocument();
    expect(screen.getByText("place (genitive)")).toBeInTheDocument();
    expect(screen.getByText("earlier draft")).toBeInTheDocument();
    expect(screen.getByText("weak")).toBeInTheDocument();
    expect(screen.getByText("uncertain genitive")).toBeInTheDocument();
    expect(screen.getByText("Sanctus Eugendus Abbas · — · Sant'Eugendo abate")).toBeInTheDocument();
  });

  it("accepts the proposal by default and an edit for another selected candidate", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={op} onDecide={onDecide} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(onDecide).toHaveBeenLastCalledWith("subject:mr:0101-eugendus", { decision: "accept" });
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(onDecide).toHaveBeenLastCalledWith("subject:mr:0101-eugendus", EDIT);
  });

  it("starts on a saved edit's candidate", () => {
    render(<OperationCard op={op} decision={EDIT as never} onDecide={vi.fn()} {...props} />);
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
  });

  it("shows Jev's edit and the take button records it", () => {
    const onDecide = vi.fn();
    const jev = { decision: "edit" as const, new_id: "mr:0101-eugendus-condatiscensis", probability: 0.87, confidence: 3, model: "jev", flags: [], scores: { "mr:0101-eugendus-condatiscensis": 2.6 } };
    render(<OperationCard op={withJev(jev)} onDecide={onDecide} {...props} />);
    expect(screen.getByText("Jev suggests: mr:0101-eugendus-condatiscensis (87%)")).toBeInTheDocument();
    expect(screen.getByText("clarity 2.6/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
    expect(onDecide).toHaveBeenCalledWith("subject:mr:0101-eugendus", EDIT);
  });

  it("shows Jev's accept as keeping the proposal", () => {
    const jev = { decision: "accept" as const, probability: 0.9, confidence: 3, model: "jev", flags: [], scores: {} };
    render(<OperationCard op={withJev(jev)} onDecide={vi.fn()} {...props} />);
    expect(screen.getByText("Jev suggests: keep the proposed ID (90%)")).toBeInTheDocument();
  });

  it("shows flags and, when Jev only doubts, no take button", () => {
    const jev = { flags: ["record:places[0]", "grammar:places[1]:genitive"], model: "jev", scores: {} };
    render(<OperationCard op={withJev(jev)} onDecide={vi.fn()} {...props} />);
    expect(screen.getByText("Jev doubts the record")).toBeInTheDocument();
    expect(screen.getByText("record: places[0]")).toBeInTheDocument();
    expect(screen.getByText("places[1] reads as genitive")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take the suggestion" })).not.toBeInTheDocument();
  });

  it("disables the take button when Jev's choice is not a candidate", () => {
    const jev = { decision: "edit" as const, new_id: "mr:0101-nope", probability: 0.8, confidence: 2, model: "jev", flags: [], scores: {} };
    render(<OperationCard op={withJev(jev)} onDecide={vi.fn()} {...props} />);
    expect(screen.getByRole("button", { name: "Take the suggestion" })).toBeDisabled();
  });

  it("records a free edit and a reject", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={op} onDecide={onDecide} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).toHaveBeenLastCalledWith("subject:mr:0101-eugendus", { decision: "reject" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("new_id"), { target: { value: "mr:0101-x" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onDecide).toHaveBeenLastCalledWith("subject:mr:0101-eugendus", { decision: "edit", edited: { new_id: "mr:0101-x", subject_la: "Sanctus Eugendus Abbas" } });
  });

  it("a rename without candidates keeps the old card", () => {
    render(<OperationCard op={{ ...op, candidates: undefined }} onDecide={vi.fn()} {...props} />);
    expect(screen.getByText("mr:0101-eugendus-abbas")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
