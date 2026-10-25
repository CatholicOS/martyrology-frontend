import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import type { RelabelJev, RelabelOp } from "@/lib/changeset";

vi.mock("@/components/EulogyView", () => ({ default: () => <div data-testid="eulogy" /> }));

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
const props = { locale: "la" as const, baseEdition: "martyrologium_romanum_2004" };
const jevBase = { probability: 0.93, confidence: 0.9, model: "jev", flags: [], scores: [2.6, 1.1, 0.4] };
const withJev = (jev: RelabelJev, extra: Partial<RelabelOp> = {}): RelabelOp => ({ ...op, jev, ...extra });
const UID = "labels:mr:0101-felix";

describe("RelabelCard", () => {
  it("shows current and candidates", () => {
    render(<OperationCard op={withJev({ ...jevBase, decision: "accept" })} onDecide={vi.fn()} {...props} />);
    expect(screen.getAllByText("Sanctus Felix · Saint Felix · San Felice")).toHaveLength(2);
    expect(screen.getByText("Sanctus Felix Romanus · Saint Felix of Rome · San Felice di Roma")).toBeInTheDocument();
    expect(screen.getByText("Sanctus Felix Nolanus · — · San Felice di Nola")).toBeInTheDocument();
    expect(screen.getByText("from mr:0101-felix-romae")).toBeInTheDocument();
    expect(screen.getByText("the current subjects")).toBeInTheDocument();
    expect(screen.getByText("clarity 2.6/3")).toBeInTheDocument();
    expect(screen.getByText("clarity 1.1/3")).toBeInTheDocument();
    expect(screen.getByText("clarity 0.4/3")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
  });

  it("accept", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={op} onDecide={onDecide} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "edit", edited: { labels: OTHER } });
  });

  it("edit three fields", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={op} onDecide={onDecide} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Latin")).toHaveValue(PROPOSED.la);
    fireEvent.change(screen.getByLabelText("Latin"), { target: { value: "Sanctus Felix presbyter" } });
    fireEvent.change(screen.getByLabelText("English"), { target: { value: "Saint Felix, priest" } });
    fireEvent.change(screen.getByLabelText("Italian"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, {
      decision: "edit",
      edited: { labels: { la: "Sanctus Felix presbyter", en: "Saint Felix, priest", it: null } },
    });
  });

  it("keep current", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={op} onDecide={onDecide} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep the current subjects" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "reject" });
    fireEvent.click(screen.getAllByRole("radio")[2]);
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "reject" });
  });

  it("take jev's suggestion", () => {
    const onDecide = vi.fn();
    const { unmount } = render(<OperationCard op={withJev({ ...jevBase, decision: "accept" })} onDecide={onDecide} {...props} />);
    expect(screen.getByText("Jev suggests: the proposed subjects (93%)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
    unmount();
    render(<OperationCard op={withJev({ ...jevBase, decision: "edit", labels: OTHER })} onDecide={onDecide} {...props} />);
    expect(screen.getByText("Jev suggests: Sanctus Felix Nolanus · — · San Felice di Nola (93%)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "edit", edited: { labels: OTHER } });
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
  });

  it("jev picks the current labels", () => {
    const onDecide = vi.fn();
    render(<OperationCard op={withJev({ ...jevBase, decision: "reject" })} onDecide={onDecide} {...props} />);
    expect(screen.getByText("Jev suggests: keep the current subjects (93%)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "reject" });
    expect(screen.getAllByRole("radio")[2]).toBeChecked();
  });

  it("shows a prefill, which another click undoes", () => {
    const onDecide = vi.fn();
    const prefilled = withJev({ ...jevBase, decision: "reject" }, { prefilled: "jev", decision: "reject" });
    render(<OperationCard op={prefilled} decision={{ decision: "reject" }} onDecide={onDecide} {...props} />);
    expect(screen.getByText("pre-filled by Jev")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[2]).toBeChecked();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(onDecide).toHaveBeenLastCalledWith(UID, { decision: "accept" });
  });

  it("a saved edit matching no candidate shows its labels, selects nothing and cannot be accepted-selected", () => {
    const typed = { la: "Sanctus Felix Typus", en: "Typed Felix", it: null };
    render(<OperationCard op={op} decision={{ decision: "edit", edited: { labels: typed } }} onDecide={vi.fn()} {...props} />);
    expect(screen.getByText("edited: Sanctus Felix Typus · Typed Felix · —")).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Accept selected" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(screen.getByRole("button", { name: "Accept selected" })).toBeEnabled();
  });

  it("a flagged relabel without a pick shows the doubt and the flags as words", () => {
    const jev = { flags: ["record:places[0]"], model: "m", scores: [1, 2] };
    render(<OperationCard op={withJev(jev)} onDecide={vi.fn()} {...props} />);
    expect(screen.getByText("Jev doubts the record")).toBeInTheDocument();
    expect(screen.getByText("record: places[0]")).toBeInTheDocument();
  });
});
