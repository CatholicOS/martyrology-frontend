import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import { exportChangeset, isAdjudicable, type ResolvePersonOp, type PersonCandidate, type Changeset } from "@/lib/changeset";

vi.mock("@/lib/api", () => ({ getElogium: vi.fn(), ApiError: class ApiError extends Error {} }));

const c = (qid: string, label: string, extra: Partial<PersonCandidate> = {}): PersonCandidate => ({
  wikidata: qid, label, description: `${label} description`, names: [label], human: true,
  statuses: ["Q43115"], born: "1564", died: "1597-02-05", feast: [], evidence: ["human", "status", "name"], ...extra,
});

const op = (extra: Partial<ResolvePersonOp> = {}): ResolvePersonOp => ({
  op: "resolve_person", id: "mr:0206-paulus-miki-et-socii|Thomas Kozaki", eulogy: "mr:0206-paulus-miki-et-socii",
  day: "02-06", typology: "dies_natalis", subject: "Sancti Paulus Miki et socii", name: "Thomas Kozaki",
  where: { footnote: 1 }, companions: ["Paulus Miki"], failed: ["name: the best candidate (Q1) fails it"],
  candidates: [c("Q1", "Thomas Kozaki"), c("Q2", "Thomas Xico")], suggested: { wikidata: "Q1" },
  reasoning: "Same martyrdom.", confidence: "high", decision: null, edited: null, ...extra,
});

const renderCard = (o: ResolvePersonOp, onDecide = vi.fn()) => {
  render(<OperationCard op={o} onDecide={onDecide} locale="en" baseEdition="martyrologium_romanum_2004" />);
  return onDecide;
};

describe("PersonCard", () => {
  it("is adjudicable and shows the name, where it is printed and the candidates", () => {
    expect(isAdjudicable(op())).toBe(true);
    renderCard(op());
    expect(screen.getByText("Thomas Kozaki", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/footnote 1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Q2" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q2");
  });

  it("accepts the suggestion as is", () => {
    const d = renderCard(op());
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(d).toHaveBeenCalledWith(op().id, { decision: "accept" });
  });

  it("records another candidate or another QID as an edit", () => {
    const d = renderCard(op());
    fireEvent.click(screen.getByLabelText(/Thomas Xico/));
    fireEvent.click(screen.getByRole("button", { name: "Accept (edited)" }));
    expect(d).toHaveBeenLastCalledWith(op().id, { decision: "edit", edited: { wikidata: "Q2" } });
    fireEvent.change(screen.getByLabelText("Other QID"), { target: { value: "Q99" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept (edited)" }));
    expect(d).toHaveBeenLastCalledWith(op().id, { decision: "edit", edited: { wikidata: "Q99" } });
  });

  it("needs a reason for No item", () => {
    const d = renderCard(op());
    fireEvent.click(screen.getByRole("button", { name: "No item" }));
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Not on Wikidata" } });
    fireEvent.click(confirm);
    expect(d).toHaveBeenCalledWith(op().id, { decision: "reject", edited: { reason: "Not on Wikidata" } });
  });

  it("exports the decision on the op", () => {
    const cs: Changeset = { schema: "crmedr-changeset/v1", generated_by: "x", base: { edition: "e", registry: "r" }, operations: [op()] };
    const out = exportChangeset(cs, { [op().id]: { decision: "edit", edited: { wikidata: "Q2" } } });
    expect(out.operations[0]).toMatchObject({ decision: "edit", edited: { wikidata: "Q2" } });
  });
});

describe("PersonCard, from the review of #113", () => {
  it("does not accept a listed candidate that crmedr's apply would refuse", () => {
    renderCard(op({ suggested: null, candidates: [c("Q1", "Thomas Kozaki", { evidence: ["human", "name"], statuses: [] }), c("Q2", "Thomas Xico")] }));
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Thomas Xico/));
    expect(screen.getByRole("button", { name: "Accept (edited)" })).toBeEnabled();
    fireEvent.click(screen.getByLabelText(/Thomas Kozaki/));
    fireEvent.change(screen.getByLabelText("Other QID"), { target: { value: "Q99" } });
    expect(screen.getByRole("button", { name: "Accept (edited)" })).toBeEnabled(); // crmedr checks a typed QID
  });

  it("decides under the op's export key", () => {
    const d = renderCard(op({ uid: "u-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(d).toHaveBeenCalledWith("u-1", { decision: "accept" });
    fireEvent.click(screen.getByRole("button", { name: "No item" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "None" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(d).toHaveBeenLastCalledWith("u-1", { decision: "reject", edited: { reason: "None" } });
  });
});
