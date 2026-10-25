import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import type { DecisionRecord, RelabelOp, RenameOp } from "@/lib/changeset";

vi.mock("@/components/EulogyView", () => ({ default: () => <div data-testid="eulogy" /> }));

// Invented subjects, never the copyrighted 2004 text.
const CURRENT = { la: "Sanctus Felix", en: "Saint Felix", it: "San Felice" };
const PROPOSED = { la: "Sanctus Felix Romanus", en: "Saint Felix of Rome", it: "San Felice di Roma" };
const OTHER = { la: "Sanctus Felix Nolanus", en: null, it: "San Felice di Nola" };
const op: RelabelOp = {
  op: "relabel",
  id: "mr:0101-felix",
  uid: "labels:mr:0101-felix",
  current: CURRENT,
  labels: PROPOSED,
  candidates: [
    { labels: PROPOSED, from_id: "mr:0101-felix-romae" },
    { labels: OTHER, from_id: "mr:0101-felix-nolae" },
    { labels: CURRENT, from_id: null },
  ],
  decision: null,
};
const rename: RenameOp = {
  op: "rename",
  id: "mr:0101-felix",
  new_id: "mr:0101-felix-romae",
  uid: "subject:mr:0101-felix",
  decision: null,
  candidates: [
    { new_id: "mr:0101-felix-romae", category: "place-genitive", weak: false, labels: PROPOSED, basis: "b" },
    { new_id: "mr:0101-felix-nolae", category: "place-genitive", weak: false, labels: OTHER, basis: "b" },
    // Deduplicated out of the relabel would need equal labels; this one is simply not among its candidates.
    { new_id: "mr:0101-felix-presbyter", category: "role", weak: false, labels: { la: "Sanctus Felix presbyter", en: null, it: null }, basis: "b" },
  ],
};
const props = { locale: "la" as const, baseEdition: "martyrologium_romanum_2004" };
const UID = "labels:mr:0101-felix";
const line = (l: { la: string | null; en: string | null; it: string | null }) => [l.la, l.en, l.it].map((x) => x ?? "—").join(" · ");
const card = (renameDecision?: DecisionRecord, extra: Partial<RelabelOp> = {}, decision?: DecisionRecord, onDecide = vi.fn()) => (
  <OperationCard op={{ ...op, ...extra }} decision={decision} rename={rename} renameDecision={renameDecision} onDecide={onDecide} {...props} />
);

describe("RelabelCard: the subject follows the ID", () => {
  it("an accepted rename: the proposal is its new ID's subject, and Follow records accept", () => {
    const onDecide = vi.fn();
    render(card({ decision: "accept" }, {}, undefined, onDecide));
    expect(screen.getByText(line(CURRENT))).toBeInTheDocument();
    expect(screen.getByText("Follows the ID mr:0101-felix-romae:")).toBeInTheDocument();
    expect(screen.getByText(line(PROPOSED))).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Follow the ID" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
  });

  it("a rename edited to another candidate: that candidate's subject", () => {
    render(card({ decision: "edit", edited: { new_id: "mr:0101-felix-nolae" } }));
    expect(screen.getByText("Follows the ID mr:0101-felix-nolae:")).toBeInTheDocument();
    expect(screen.getByText(line(OTHER))).toBeInTheDocument();
    expect(screen.queryByText(line(PROPOSED))).not.toBeInTheDocument();
  });

  it("a rename candidate missing from the relabel: its labels, a missing language from the current", () => {
    render(card({ decision: "edit", edited: { new_id: "mr:0101-felix-presbyter" } }));
    expect(screen.getByText("Sanctus Felix presbyter · Saint Felix · San Felice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow the ID" })).toBeEnabled();
  });

  it("updates when the rename decision changes", () => {
    const { rerender } = render(card({ decision: "accept" }));
    expect(screen.getByText(line(PROPOSED))).toBeInTheDocument();
    rerender(card({ decision: "edit", edited: { new_id: "mr:0101-felix-nolae" } }));
    expect(screen.getByText(line(OTHER))).toBeInTheDocument();
    expect(screen.queryByText(line(PROPOSED))).not.toBeInTheDocument();
  });

  it("an undecided rename: the subject of its proposed ID, following an undecided ID", () => {
    render(card(undefined));
    expect(screen.getByText("Follows an undecided ID, mr:0101-felix-romae:")).toBeInTheDocument();
    expect(screen.getByText(line(PROPOSED))).toBeInTheDocument();
    // crmedr rejects an accepted relabel with no decided rename: Follow waits for the ID.
    expect(screen.getByRole("button", { name: "Follow the ID" })).toBeDisabled();
    expect(screen.getByText("Decide the ID first: the subject follows it.")).toBeInTheDocument();
  });

  it("a typed ID implies no subject: Follow is disabled, with the reason", () => {
    render(card({ decision: "edit", edited: { new_id: "mr:0101-felix-typed" } }));
    expect(screen.getByRole("button", { name: "Follow the ID" })).toBeDisabled();
    expect(screen.getByText("The ID mr:0101-felix-typed is typed, not a candidate: it implies no subject. Edit the wording instead.")).toBeInTheDocument();
  });

  it("a rejected rename, or none: Follow is disabled, with the reason", () => {
    const { unmount } = render(card({ decision: "reject" }));
    expect(screen.getByRole("button", { name: "Follow the ID" })).toBeDisabled();
    expect(screen.getByText("The ID is not renamed: there is no ID to follow.")).toBeInTheDocument();
    unmount();
    render(<OperationCard op={op} onDecide={vi.fn()} {...props} />);
    expect(screen.getByRole("button", { name: "Follow the ID" })).toBeDisabled();
  });

  it("an accept whose ID changed to a typed ID: a warning instead of the badge, the other actions still there", () => {
    render(card({ decision: "edit", edited: { new_id: "mr:0101-felix-typed" } }, {}, { decision: "accept" }));
    expect(screen.getByText("Accepted, but the ID it follows changed: decide again")).toBeInTheDocument();
    expect(screen.queryByText("accept")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow the ID" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit the wording" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Keep the current subject" })).toBeEnabled();
  });

  it("an accept that still follows its ID keeps the plain badge", () => {
    render(card({ decision: "accept" }, {}, { decision: "accept" }));
    expect(screen.getByText("accept")).toBeInTheDocument();
    expect(screen.queryByText("Accepted, but the ID it follows changed: decide again")).not.toBeInTheDocument();
  });

  it("edit the wording: three fields prefilled with the followed subject", () => {
    const onDecide = vi.fn();
    render(card({ decision: "edit", edited: { new_id: "mr:0101-felix-nolae" } }, {}, undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Edit the wording" }));
    expect(screen.getByLabelText("Latin")).toHaveValue(OTHER.la);
    expect(screen.getByLabelText("English")).toHaveValue("");
    expect(screen.getByLabelText("Italian")).toHaveValue(OTHER.it);
    fireEvent.change(screen.getByLabelText("English"), { target: { value: "Saint Felix of Nola" } });
    fireEvent.change(screen.getByLabelText("Italian"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, {
      decision: "edit",
      edited: { labels: { la: "Sanctus Felix Nolanus", en: "Saint Felix of Nola", it: null } },
    });
  });

  it("saving the followed wording unchanged records accept; the current wording, reject; else edit", () => {
    const onDecide = vi.fn();
    render(card({ decision: "accept" }, {}, undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Edit the wording" }));
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
    fireEvent.click(screen.getByRole("button", { name: "Edit the wording" }));
    for (const [name, k] of [["Latin", "la"], ["English", "en"], ["Italian", "it"]] as const) fireEvent.change(screen.getByLabelText(name), { target: { value: CURRENT[k] } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "reject" });
  });

  it("saving the followed wording while Follow is impossible (rename undecided) records an edit", () => {
    const onDecide = vi.fn();
    render(card(undefined, {}, undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Edit the wording" }));
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "edit", edited: { labels: PROPOSED } });
  });

  it("edit with no followed subject starts from the current subject", () => {
    render(card({ decision: "edit", edited: { new_id: "mr:0101-felix-typed" } }));
    fireEvent.click(screen.getByRole("button", { name: "Edit the wording" }));
    expect(screen.getByLabelText("Latin")).toHaveValue(CURRENT.la);
  });

  it("keep the current subject", () => {
    const onDecide = vi.fn();
    render(card({ decision: "accept" }, {}, undefined, onDecide));
    fireEvent.click(screen.getByRole("button", { name: "Keep the current subject" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "reject" });
  });

  it("never shows Jev, even when the op carries an old jev", () => {
    const jev = { decision: "edit" as const, labels: OTHER, probability: 0.93, confidence: 0.9, model: "jev", flags: ["record:places[0]"], scores: [2.6, 1.1, 0.4] };
    render(card({ decision: "accept" }, { jev, prefilled: "jev" }));
    expect(screen.queryByText(/Jev/)).not.toBeInTheDocument();
    expect(screen.queryByText(/clarity/)).not.toBeInTheDocument();
    expect(screen.queryByText("record: places[0]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take the suggestion" })).not.toBeInTheDocument();
  });

  it("a saved hand-typed edit shows its labels", () => {
    const typed = { la: "Sanctus Felix Typus", en: "Typed Felix", it: null };
    render(card({ decision: "accept" }, {}, { decision: "edit", edited: { labels: typed } }));
    expect(screen.getByText("edited: Sanctus Felix Typus · Typed Felix · —")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit the wording" }));
    expect(screen.getByLabelText("Latin")).toHaveValue(typed.la);
  });

  it("the Wikidata hint: the item's labels, the QID linked, as a reference for the wording", () => {
    render(card({ decision: "accept" }, { hint: { wikidata: "Q4115189", labels: { en: "Felix of Rome", it: null } } }));
    expect(screen.getByText("a reference for the wording, not a choice")).toBeInTheDocument();
    expect(screen.getByText("Wikidata: Felix of Rome · —")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Q4115189" });
    expect(link).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q4115189");
  });

  it("no hint without op.hint", () => {
    render(card({ decision: "accept" }));
    expect(screen.queryByText(/^Wikidata:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
