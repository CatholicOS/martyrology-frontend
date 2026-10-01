import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OperationCard from "@/components/OperationCard";
import PlaceCard from "@/components/PlaceCard";
import type { ResolvePlaceOp, PlaceCandidate } from "@/lib/changeset";

vi.mock("@/lib/api", () => ({
  getElogium: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 0;
    title = "";
  },
}));

vi.mock("@/components/PlaceMap", () => ({
  default: ({ points, selected, onSelect }: { points: { wikidata: string }[]; selected: string; onSelect: (q: string) => void }) => (
    <div data-testid="place-map">
      {points.map((p) => p.wikidata).join(",")}|{selected}
      {points.map((p) => (
        <button key={p.wikidata} type="button" onClick={() => onSelect(p.wikidata)}>
          pick {p.wikidata}
        </button>
      ))}
    </div>
  ),
}));

import { getElogium } from "@/lib/api";

function candidate(qid: string, label: string, country: string | null, extra: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    wikidata: qid,
    label,
    description: `${label} description`,
    country,
    countries: country ? [country] : ["FR", "IT"],
    la: [`${label}ia`],
    p9314: false,
    coords: [45.1, 9.2],
    types: ["Q486972"],
    evidence: ["it", "type"],
    ...extra,
  };
}

const claimIt = "A Fictopoli nel Fictiense, nell’odierna Germania";

function makeOp(extra: Partial<ResolvePlaceOp> = {}): ResolvePlaceOp {
  return {
    op: "resolve_place",
    id: "Fictópoli in Fíctia",
    la: "Fictópoli in Fíctia",
    it: [claimIt],
    occurrences: ["mr:0101-fictus", "mr:0202-fictitius"],
    claims: [{ country: "DE", it: claimIt }],
    failed: ["country: the Italian says DE, the item is in AT"],
    candidates: [candidate("Q1", "Fictopolis", "AT"), candidate("Q2", "Fictopolis Nova", "FR")],
    suggested: { wikidata: "Q1", country: "AT", text_says: [{ country: "DE", it: claimIt }] },
    reasoning: "Fictopolis is the town on the river.",
    confidence: "high",
    decision: null,
    edited: null,
    ...extra,
  };
}

function renderCard(op: ResolvePlaceOp, onDecide = vi.fn(), decision?: Parameters<typeof PlaceCard>[0]["decision"]) {
  render(<PlaceCard op={op} onDecide={onDecide} decision={decision} locale="la" baseEdition="martyrologium_romanum_2004" />);
  return onDecide;
}

describe("PlaceCard", () => {
  beforeEach(() => {
    vi.mocked(getElogium).mockReset();
  });

  it("shows the place, why it is queued, the suggestion and the candidates with links", () => {
    renderCard(makeOp());
    expect(screen.getByText("Fictópoli in Fíctia")).toBeInTheDocument();
    expect(screen.getAllByText(claimIt).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/the Italian says DE, the item is in AT/)).toBeInTheDocument();
    expect(screen.getByText(/Fictopolis is the town on the river\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Q1" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q1");
    expect(screen.getByLabelText(/Fictopolis —/)).toBeChecked();
    expect(screen.getByLabelText(/country/i)).toHaveValue("AT");
    expect(screen.getByRole("checkbox", { name: /the text says DE/i })).toBeChecked();
  });

  it("accepting the unchanged suggestion records a plain accept", () => {
    const onDecide = renderCard(makeOp());
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", { decision: "accept" });
  });

  it("choosing another candidate records an edit without the suggestion's text_says", () => {
    const onDecide = renderCard(makeOp());
    fireEvent.click(screen.getByLabelText(/Fictopolis Nova —/));
    expect(screen.getByLabelText(/country/i)).toHaveValue("FR");
    // the DE claim still disagrees with FR, so it stays checked
    expect(screen.getByRole("checkbox", { name: /the text says DE/i })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /the text says DE/i }));
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "edit",
      edited: { wikidata: "Q2", country: "FR", text_says: [] },
    });
  });

  it("a typed QID with a country records an edit", () => {
    const onDecide = renderCard(makeOp({ claims: [], suggested: undefined }));
    fireEvent.change(screen.getByLabelText(/other qid/i), { target: { value: "Q999" } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: "de" } });
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "edit",
      edited: { wikidata: "Q999", country: "DE", text_says: [] },
    });
  });

  it("unchecking the suggested text_says records an edit", () => {
    const onDecide = renderCard(makeOp());
    fireEvent.click(screen.getByRole("checkbox", { name: /the text says DE/i }));
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "edit",
      edited: { wikidata: "Q1", country: "AT", text_says: [] },
    });
  });

  it("without a suggestion the top candidate is preselected and a disagreeing claim is prechecked", () => {
    const onDecide = renderCard(makeOp({ suggested: undefined }));
    expect(screen.getByLabelText(/Fictopolis —/)).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /the text says DE/i })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", { decision: "accept" });
  });

  it("accept is disabled until a country is set", () => {
    const op = makeOp({ suggested: undefined, claims: [], candidates: [candidate("Q3", "Fictaria", null)] });
    const onDecide = renderCard(op);
    const accept = screen.getByRole("button", { name: /^accept/i });
    expect(accept).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: "IT" } });
    expect(accept).not.toBeDisabled();
    fireEvent.click(accept);
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "edit",
      edited: { wikidata: "Q3", country: "IT", text_says: [] },
    });
  });

  it("labels a candidate's country, its countries, or ? when it has neither", () => {
    renderCard(
      makeOp({
        candidates: [
          candidate("Q1", "Fictopolis", "AT"),
          candidate("Q4", "Fictoria", null),
          candidate("Q5", "Fictana", null, { countries: [] }),
        ],
      }),
    );
    expect(screen.getByLabelText(/Fictopolis —/).parentElement).toHaveTextContent(/· AT · suggested$/);
    expect(screen.getByLabelText(/Fictoria —/).parentElement).toHaveTextContent(/· FR\/IT$/);
    expect(screen.getByLabelText(/Fictana —/).parentElement).toHaveTextContent(/· \?$/);
  });

  it("an invalid country code disables accept", () => {
    renderCard(makeOp());
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: "AUT" } });
    expect(screen.getByRole("button", { name: /^accept/i })).toBeDisabled();
  });

  it("reject asks for a reason", () => {
    const onDecide = renderCard(makeOp());
    fireEvent.click(screen.getByRole("button", { name: /^reject/i }));
    const confirm = screen.getByRole("button", { name: /confirm reject/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "no item for the hill" } });
    fireEvent.click(confirm);
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "reject",
      edited: { reason: "no item for the hill" },
    });
  });

  it("opens the map on demand and selects a candidate from it", () => {
    renderCard(makeOp());
    expect(screen.queryByTestId("place-map")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show map/i }));
    expect(screen.getByTestId("place-map")).toHaveTextContent("Q1,Q2|Q1");
    fireEvent.click(screen.getByRole("button", { name: "pick Q2" }));
    expect(screen.getByLabelText(/Fictopolis Nova —/)).toBeChecked();
    expect(screen.getByLabelText(/country/i)).toHaveValue("FR");
  });

  it("loads an occurrence's eulogy only when asked", () => {
    vi.mocked(getElogium).mockReturnValue(new Promise(() => {}));
    renderCard(makeOp());
    expect(getElogium).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "mr:0202-fictitius" }));
    expect(getElogium).toHaveBeenCalledWith("mr:0202-fictitius");
  });

  it("resumes a saved edit", () => {
    renderCard(makeOp(), vi.fn(), { decision: "edit", edited: { wikidata: "Q2", country: "FR", text_says: [] } });
    expect(screen.getByLabelText(/Fictopolis Nova —/)).toBeChecked();
    expect(screen.getByLabelText(/country/i)).toHaveValue("FR");
    expect(screen.getByRole("checkbox", { name: /the text says DE/i })).not.toBeChecked();
  });

  it("OperationCard renders a PlaceCard for resolve_place without fetching a eulogy", () => {
    render(<OperationCard op={makeOp()} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_2004" />);
    expect(screen.getByText("Fictópoli in Fíctia")).toBeInTheDocument();
    expect(getElogium).not.toHaveBeenCalled();
  });
});
