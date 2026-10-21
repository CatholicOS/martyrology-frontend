import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
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
    suggested: { wikidata: "Q1", country: "AT" },
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
    // text_says is derived and shown read-only: no checkboxes
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-says")).toHaveTextContent(/The Italian says DE/);
    expect(screen.getByTestId("text-says")).toHaveTextContent(claimIt);
  });

  it("accepting the unchanged suggestion records a plain accept", () => {
    const onDecide = renderCard(makeOp());
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", { decision: "accept" });
  });

  it("choosing another candidate records an edit; text_says follows the chosen country", () => {
    const onDecide = renderCard(makeOp());
    fireEvent.click(screen.getByLabelText(/Fictopolis Nova —/));
    expect(screen.getByLabelText(/country/i)).toHaveValue("FR");
    // the DE claim still disagrees with FR
    expect(screen.getByTestId("text-says")).toHaveTextContent(/The Italian says DE/);
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "edit",
      edited: { wikidata: "Q2", country: "FR" },
    });
  });

  it("a typed QID with a country records an edit", () => {
    const onDecide = renderCard(makeOp({ claims: [], suggested: undefined }));
    fireEvent.change(screen.getByLabelText(/other qid/i), { target: { value: "Q999" } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: "de" } });
    fireEvent.click(screen.getByRole("button", { name: /^accept/i }));
    expect(onDecide).toHaveBeenCalledWith("Fictópoli in Fíctia", {
      decision: "edit",
      edited: { wikidata: "Q999", country: "DE" },
    });
  });

  it("a country that agrees with the Italian claim records no text_says", () => {
    renderCard(makeOp());
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: "DE" } });
    expect(screen.queryByTestId("text-says")).not.toBeInTheDocument();
  });

  it("claims that agree with the chosen country are not shown", () => {
    const agrees = "Ad Fictiochia di Fictia, oggi in Austria";
    renderCard(makeOp({ it: [claimIt, agrees], claims: [{ country: "DE", it: claimIt }, { country: "AT", it: agrees }] }));
    expect(screen.getByTestId("text-says")).toHaveTextContent(claimIt);
    expect(screen.getByTestId("text-says")).not.toHaveTextContent(agrees);
  });

  it("without a suggestion the top candidate is preselected and a disagreeing claim is prechecked", () => {
    const onDecide = renderCard(makeOp({ suggested: undefined }));
    expect(screen.getByLabelText(/Fictopolis —/)).toBeChecked();
    expect(screen.getByTestId("text-says")).toHaveTextContent(/The Italian says DE/);
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
      edited: { wikidata: "Q3", country: "IT" },
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

  it("shows an occurrence's Latin 2004 text alongside the Italian 2004", async () => {
    vi.mocked(getElogium).mockResolvedValue({
      id: "mr:0202-fictitius",
      subject: { la: "Fictitius" },
      editions: {
        martyrologium_romanum_1749: { text: "Antiqua" },
        martyrologium_romanum_2004: { text: "Fictópoli in Fíctia, sancti Fictitii." },
        martyrologium_romanum_2004_it_IT: { text: "A Fictopoli nel Fictiense, san Fittizio." },
      },
    } as never);
    renderCard(makeOp());
    fireEvent.click(screen.getByRole("button", { name: "mr:0202-fictitius" }));
    expect(await screen.findByText("Fictópoli in Fíctia, sancti Fictitii.")).toBeInTheDocument();
    expect(screen.getByText("A Fictopoli nel Fictiense, san Fittizio.")).toBeInTheDocument();
    expect(screen.queryByText("Antiqua")).not.toBeInTheDocument();
  });

  it("says so when the occurrence has no Italian 2004 text", async () => {
    vi.mocked(getElogium).mockResolvedValue({
      id: "mr:0202-fictitius",
      subject: { la: "Fictitius" },
      editions: { martyrologium_romanum_2004: { text: "Fictópoli in Fíctia, sancti Fictitii." } },
    } as never);
    renderCard(makeOp());
    fireEvent.click(screen.getByRole("button", { name: "mr:0202-fictitius" }));
    expect(await screen.findByText("Fictópoli in Fíctia, sancti Fictitii.")).toBeInTheDocument();
    expect(screen.getByText("(no text in martyrologium_romanum_2004_it_IT)")).toBeInTheDocument();
  });

  it("resumes a saved edit", () => {
    renderCard(makeOp(), vi.fn(), { decision: "edit", edited: { wikidata: "Q2", country: "FR" } });
    expect(screen.getByLabelText(/Fictopolis Nova —/)).toBeChecked();
    expect(screen.getByLabelText(/country/i)).toHaveValue("FR");
    expect(screen.getByTestId("text-says")).toHaveTextContent(/The Italian says DE/);
  });

  it("OperationCard renders a PlaceCard for resolve_place without fetching a eulogy", () => {
    render(<OperationCard op={makeOp()} onDecide={vi.fn()} locale="la" baseEdition="martyrologium_romanum_2004" />);
    expect(screen.getByText("Fictópoli in Fíctia")).toBeInTheDocument();
    expect(getElogium).not.toHaveBeenCalled();
  });
  describe("Jev", () => {
    const jev = (extra: object) => ({ kind: "place", probability: 0.93, confidence: 0.9, model: "jev", ...extra }) as ResolvePlaceOp["jev"];

    it("shows the hint after the candidates and puts Take first in the row", () => {
      renderCard(makeOp({ jev: jev({ decision: "edit", wikidata: "Q2", country: "FR" }) }));
      const take = screen.getByRole("button", { name: "Take the suggestion" });
      expect(take.parentElement?.firstElementChild).toBe(take);
      const hint = screen.getByText("Jev suggests: Q2 Fictopolis Nova (93%)");
      expect(screen.getByLabelText(/Fictopolis Nova —/).compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(hint.compareDocumentPosition(take) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("explains a disabled Take", () => {
      renderCard(makeOp({ jev: jev({ decision: "edit", wikidata: "Q2" }) }));
      const take = screen.getByRole("button", { name: "Take the suggestion" });
      expect(take).toBeDisabled();
      expect(take).toHaveAttribute("title", "The suggested item has no country: choose it and set the country");
    });

    it("takes the pick: records it and moves the selection and country", () => {
      const d = renderCard(makeOp({ jev: jev({ decision: "edit", wikidata: "Q2", country: "FR" }) }));
      fireEvent.change(screen.getByLabelText("Other QID"), { target: { value: "Q99" } });
      fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
      expect(d).toHaveBeenCalledWith("Fictópoli in Fíctia", { decision: "edit", edited: { wikidata: "Q2", country: "FR" } });
      expect(screen.getByLabelText(/Fictopolis Nova —/)).toBeChecked();
      expect(screen.getByLabelText("Other QID")).toHaveValue("");
      expect(screen.getByLabelText(/country/i)).toHaveValue("FR");
    });

    it("takes a reject as a reject with its reason", () => {
      const d = renderCard(makeOp({ jev: jev({ decision: "reject", reason: "Jev: not a place", kind: "not_place" }) }));
      expect(screen.getByText("Jev suggests: no item (93%)")).toBeInTheDocument();
      expect(screen.getByText("Jev reads this as not a place")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Take the suggestion" }));
      expect(d).toHaveBeenCalledWith("Fictópoli in Fíctia", { decision: "reject", edited: { reason: "Jev: not a place" } });
    });

    it("disables Take when the pick has no country", () => {
      renderCard(makeOp({ candidates: [candidate("Q1", "Fictopolis", "AT"), candidate("Q3", "Nowhere", null)], jev: jev({ decision: "edit", wikidata: "Q3" }) }));
      expect(screen.getByRole("button", { name: "Take the suggestion" })).toBeDisabled();
    });

    it("a kind-only jev shows the kind and no Take", () => {
      renderCard(makeOp({ jev: jev({}) }));
      expect(screen.getByText("Jev reads this as a place")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Take the suggestion" })).toBeNull();
    });

    it("notes a people kind next to the hint", () => {
      renderCard(makeOp({ jev: jev({ decision: "reject", reason: "r", kind: "people" }) }));
      expect(screen.getByText("Jev reads this as a nationality or people, not a place")).toBeInTheDocument();
    });

    it("marks a pre-filled card, and shows nothing without Jev", () => {
      const { unmount } = render(<PlaceCard op={makeOp({ prefilled: "jev", jev: jev({ decision: "accept", wikidata: "Q1", country: "AT" }) })} onDecide={vi.fn()} locale="la" baseEdition="x" />);
      expect(screen.getByText("pre-filled by Jev")).toBeInTheDocument();
      unmount();
      renderCard(makeOp());
      expect(screen.queryByText("pre-filled by Jev")).toBeNull();
      expect(screen.queryByText(/Jev suggests/)).toBeNull();
    });

    it("the reject form replaces the row", () => {
      renderCard(makeOp({ jev: jev({ decision: "edit", wikidata: "Q2", country: "FR" }) }));
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      expect(screen.queryByRole("button", { name: "Take the suggestion" })).toBeNull();
    });
  });
});
