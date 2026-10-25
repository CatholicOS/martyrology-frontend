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

  it("says which person of the name it is, from the second", () => {
    renderCard(op({ id: "mr:0212-x|Felix#2", name: "Felix", n: 2 }));
    expect(screen.getByText("the 2nd of this name in this eulogy")).toBeInTheDocument();
  });

  it("says nothing of the first", () => {
    renderCard(op());
    expect(screen.queryByText(/of this name in this eulogy/)).toBeNull();
  });

  it("shows the person's other names", () => {
    renderCard(op({ name: "Kinga", also: ["Cunegundis", "Mames"] }));
    const names = screen.getByText("Cunegundis, Mames");
    expect(names).toHaveAttribute("lang", "la");
    expect(names.closest("p")).toHaveTextContent("Also: Cunegundis, Mames");
    expect(names.closest("p")).not.toHaveAttribute("lang");
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

  describe("sources and Jev", () => {
    const jev = (extra: object) => ({ probability: 0.93, confidence: 0.9, model: "jev", ...extra }) as ResolvePersonOp["jev"];
    const withQ2 = (extra: Partial<ResolvePersonOp> = {}) =>
      op({ candidates: [c("Q1", "Thomas Kozaki"), c("Q2", "Jean Légo")], ...extra });

    it("shows how a non-search candidate was found", () => {
      renderCard(op({ candidates: [c("Q1", "Thomas Kozaki"), c("Q2", "Thomas Xico", { source: "companion:P3373" })] }));
      expect(screen.getByText("found through a relative (P3373)")).toBeInTheDocument();
    });

    it("says a P361 candidate was found through a group", () => {
      renderCard(op({ candidates: [c("Q1", "Thomas Kozaki"), c("Q2", "Thomas Xico", { source: "companion:P361" })] }));
      expect(screen.getByText("found through a group (P361)")).toBeInTheDocument();
    });

    it("taking Jev's accept resets a typed QID and the selection", () => {
      renderCard(withQ2({ suggested: { wikidata: "Q1" }, jev: jev({ decision: "accept", wikidata: "Q1" }) }));
      fireEvent.click(screen.getByLabelText(/Jean Légo/));
      fireEvent.change(screen.getByLabelText("Other QID"), { target: { value: "Q99" } });
      fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
      expect(screen.getByLabelText("Other QID")).toHaveValue("");
      expect(screen.getByLabelText(/Thomas Kozaki/)).toBeChecked();
    });

    it("puts Take first in the button row, under the hint and the candidates; the reject form replaces the row", () => {
      renderCard(withQ2({ jev: jev({ decision: "edit", wikidata: "Q2" }) }));
      const take = screen.getByRole("button", { name: "Take the suggestion" });
      expect(take.parentElement?.firstElementChild).toBe(take);
      expect(take.parentElement).toContainElement(screen.getByRole("button", { name: "No item" }));
      const hint = screen.getByText("Jev suggests: Q2 Jean Légo (93%)");
      const candidate = screen.getByLabelText(/Jean Légo/);
      expect(candidate.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(hint.compareDocumentPosition(take) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "No item" }));
      expect(screen.queryByRole("button", { name: "Take the suggestion" })).not.toBeInTheDocument();
    });

    it("accepts a title item that is not a human", () => {
      const d = renderCard(op({ candidates: [c("Q1", "Thomas Kozaki"), c("Q7", "Feast item", { evidence: ["name"], source: "title" })] }));
      expect(screen.getByText("title or feast")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(/Feast item/));
      fireEvent.click(screen.getByRole("button", { name: "Accept (edited)" }));
      expect(d).toHaveBeenCalledWith(op().id, { decision: "edit", edited: { wikidata: "Q7" } });
    });

    it("takes Jev's edit and moves the selection", () => {
      const d = renderCard(withQ2({ jev: jev({ decision: "edit", wikidata: "Q2" }) }));
      expect(screen.getByText("Jev suggests: Q2 Jean Légo (93%)")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
      expect(d).toHaveBeenCalledWith(op().id, { decision: "edit", edited: { wikidata: "Q2" } });
      expect(screen.getByLabelText(/Jean Légo/)).toBeChecked();
    });

    it("takes Jev's rejection and notes an odd kind", () => {
      const d = renderCard(op({ jev: jev({ decision: "reject", reason: "A place", kind: "celebration_or_title" }) }));
      expect(screen.getByText("Jev suggests: no item (93%)")).toBeInTheDocument();
      expect(screen.getByText("Jev reads this name as: a feast or title")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
      expect(d).toHaveBeenCalledWith(op().id, { decision: "reject", edited: { reason: "A place" } });
    });

    it("disables the button for an unlisted item and shows nothing without Jev", () => {
      const { unmount } = render(<OperationCard op={op({ jev: jev({ decision: "edit", wikidata: "Q9" }) })} onDecide={vi.fn()} locale="en" baseEdition="x" />);
      expect(screen.getByRole("button", { name: "Take the suggestion" })).toBeDisabled();
      unmount();
      renderCard(op());
      expect(screen.queryByText(/Jev suggests/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Take the suggestion" })).toBeNull();
    });
  });

  it("shows evidence as chips", () => {
    renderCard(op({ candidates: [c("Q1", "Thomas Kozaki", { evidence: ["human", "status", "name", "death", "place"] })], suggested: null }));
    for (const w of ["human", "saint or blessed", "name matches", "death date matches", "place matches"]) {
      expect(screen.getByText(w)).toBeInTheDocument();
    }
  });

  it("shows the place agreement", () => {
    renderCard(op({
      candidates: [c("Q1", "Thomas Kozaki", { places: [{ role: "death_place", qid: "Q1891", label: "Bologna", via: "P20" }, { role: "birth_place", qid: "Q220", via: "P19" }] })],
      suggested: null,
    }));
    expect(screen.getByText("died in Bologna")).toBeInTheDocument();
    expect(screen.getByText("born in Q220")).toBeInTheDocument();
  });

  it("shows unknown evidence raw", () => {
    renderCard(op({ candidates: [c("Q1", "Thomas Kozaki", { evidence: ["mystery"] })], suggested: null }));
    expect(screen.getByText("mystery")).toBeInTheDocument();
  });

  it("badges a candidate found through a place", () => {
    renderCard(op({ candidates: [c("Q1", "Thomas Kozaki", { source: "place" })], suggested: null }));
    expect(screen.getByText("found through a place")).toBeInTheDocument();
  });
});
