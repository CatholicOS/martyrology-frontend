import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/intl";
import ReviewPage from "@/components/ReviewPage";

vi.mock("@/lib/api", () => ({
  getElogium: vi.fn(() => new Promise(() => {})),
  ApiError: class ApiError extends Error {},
}));

const ops = Array.from({ length: 120 }, (_, i) => ({
  op: "resolve_place",
  id: `Fictopoli ${i}`,
  la: `Fictopoli ${i}`,
  it: [],
  occurrences: [],
  claims: [],
  failed: [],
  candidates: [],
  decision: null,
  edited: null,
}));
const cs = { schema: "crmedr-changeset/v1", generated_by: "t", base: { edition: "2004", registry: "data/places.json" }, operations: ops };

describe("ReviewPage paging", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ changesets: ["gazetteer-review.json"] }),
          text: () => Promise.resolve(JSON.stringify(cs)),
          url,
        })
      )
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders 50 cards at a time", async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "gazetteer-review.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "gazetteer-review.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(50));
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(100);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(120);
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });
});

describe("ReviewPage with a mentions change-set", () => {
  // Invented Latin, never the copyrighted 2004 text.
  const context = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.";
  const common = { edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text", context, context_start: 120, decision: null, edited: null };
  const mentions = {
    schema: "crmedr-changeset/v1", generated_by: "scripts/extract_mentions.py",
    base: { edition: "martyrologium_romanum_2004", registry: "data/mentions.json" },
    operations: [
      { ...common, op: "add_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|156", kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni" },
      { ...common, op: "remove_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|120", kind: "place", start: 120, end: 129, form: "Fictópoli" },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ changesets: ["mentions-review-01.json"] }),
      text: () => Promise.resolve(JSON.stringify(mentions)),
      url,
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a card per operation and filters them by op", async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "mentions-review-01.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "mentions-review-01.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    expect(screen.getByText("Mark these words as a person")).toBeInTheDocument();
    // The op filter is the select that offers the ops this change-set holds.
    fireEvent.change(screen.getByRole("option", { name: "remove_mention" }).closest("select")!, { target: { value: "remove_mention" } });
    expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(1);
    expect(screen.getByText("Remove the mark on this place")).toBeInTheDocument();
  });
});

describe("ReviewPage bulk accept", () => {
  const place = (eulogy: string, confidence: string) => ({
    op: "add_place", id: `${eulogy}#birth#Romæ`, eulogy, role: "birth", la: "Romæ", confidence, decision: null, edited: null,
  });
  const places = {
    schema: "crmedr-changeset/v1", generated_by: "scripts/body_places.py",
    base: { edition: "martyrologium_romanum_2004", registry: "data/places_curated.json" },
    operations: [place("mr:0101-a", "high"), place("mr:0101-b", "high"), place("mr:0101-c", "low")],
  };

  beforeEach(() => {
    localStorage.clear(); // a bulk accept saves its decisions; each test starts undecided
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ changesets: ["places-review.json"] }),
      text: () => Promise.resolve(JSON.stringify(places)),
      url,
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("bulk-accepts the undecided add_place ops of one confidence", async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "places-review.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "places-review.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(3));
    expect(screen.queryByRole("button", { name: /Accept the \d+ undecided shown/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("option", { name: "add_place" }).closest("select")!, { target: { value: "add_place" } });
    expect(screen.queryByRole("button", { name: /Accept the \d+ undecided shown/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("option", { name: "high" }).closest("select")!, { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept the 2 undecided shown" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText("2 accepted")).toBeInTheDocument();
    expect(screen.getByText("1 undecided")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept the \d+ undecided shown/ })).not.toBeInTheDocument();
  });

  it("a confirmation asked for one batch does not carry over to another", async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "places-review.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "places-review.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(3));
    fireEvent.change(screen.getByRole("option", { name: "add_place" }).closest("select")!, { target: { value: "add_place" } });
    const confidence = screen.getByRole("option", { name: "high" }).closest("select")!;
    fireEvent.change(confidence, { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept the 2 undecided shown" }));
    fireEvent.change(confidence, { target: { value: "low" } });
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept the 1 undecided shown" })).toBeInTheDocument();
  });
});

describe("ReviewPage groups a eulogy's cards", () => {
  const person = (eulogy: string, name: string, n?: number) => ({
    op: "resolve_person", id: `${eulogy}|${name}${n ? `#${n}` : ""}`, eulogy, day: "01-01", typology: null, subject: "Fictinus",
    name, ...(n ? { n } : {}), where: "text", companions: [], failed: [], candidates: [], suggested: null,
    reasoning: "r", confidence: "high", class: "bare", decision: null, edited: null,
  });
  const rename = (id: string) => ({
    op: "rename", id, new_id: `${id}-abbas`, uid: `subject:${id}`, subject_la: "Fictinus", class: "bare", confidence: "high",
    reasoning: "r", decision: null,
    candidates: [{ new_id: `${id}-abbas`, category: "role", weak: false, labels: { la: "Fictinus Abbas", en: null, it: null }, basis: "bare-name draft" }],
  });
  const load = async (operations: unknown[], file: string) => {
    const set = { schema: "crmedr-changeset/v1", generated_by: "t", base: { edition: "martyrologium_romanum_1749", registry: "data/subjects.json" }, operations };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true, json: () => Promise.resolve({ changesets: [file] }), text: () => Promise.resolve(JSON.stringify(set)), url,
    })));
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: file })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: file } });
  };
  afterEach(() => vi.unstubAllGlobals());

  it("puts the rename before the person cards under one heading per eulogy", async () => {
    await load([person("mr:0101-a", "Fictinus"), rename("mr:0102-b"), rename("mr:0101-a"), person("mr:0102-b", "Ficta", 2)], "month.json");
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(4));
    const headings = screen.getAllByText(/^Eulogy mr:/);
    expect(headings.map((h) => h.textContent)).toEqual(["Eulogy mr:0101-a", "Eulogy mr:0102-b"]);
    const ids = screen.getAllByTestId(/^op-card-/).map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual([
      "op-card-subject:mr:0101-a", "op-card-mr:0101-a|Fictinus",
      "op-card-subject:mr:0102-b", "op-card-mr:0102-b|Ficta#2",
    ]);
  });

  it("keeps file order and shows no heading without rename candidates", async () => {
    await load([person("mr:0102-b", "Ficta"), person("mr:0101-a", "Fictinus")], "people.json");
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    expect(screen.queryByText(/^Eulogy mr:/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^op-card-/).map((el) => el.getAttribute("data-testid"))).toEqual(["op-card-mr:0102-b|Ficta", "op-card-mr:0101-a|Fictinus"]);
  });
});

describe("ReviewPage stores the resolved target of an accept", () => {
  // Invented records, never the copyrighted 2004 text.
  const person = {
    op: "resolve_person", id: "mr:0101-fictinus|Fictinus", eulogy: "mr:0101-fictinus", day: "01-01", typology: "dies_natalis",
    subject: "Sanctus Fictinus", name: "Fictinus", where: "text", companions: [], failed: [],
    candidates: ["Q1", "Q2"].map((q) => ({ wikidata: q, label: `Fictinus ${q}`, description: "d", names: ["Fictinus"], human: true, statuses: ["Q43115"], born: null, died: null, feast: [], evidence: ["human", "status", "name"] })),
    suggested: null, confidence: "high", decision: null, edited: null,
  };
  const rename = {
    op: "rename", id: "mr:0102-ficta", new_id: "mr:0102-ficta-abbatissa", uid: "subject:mr:0102-ficta", subject_la: "Sancta Ficta",
    class: "bare", confidence: "medium", decision: null,
    candidates: [{ new_id: "mr:0102-ficta-abbatissa", category: "role-place", weak: false, labels: { la: "Sancta Ficta Abbatissa", en: null, it: null }, basis: "bare-name draft" }],
  };
  const changeset = {
    schema: "crmedr-changeset/v1", generated_by: "t",
    base: { edition: "martyrologium_romanum_2004", registry: "data/test.json" }, operations: [person, rename],
  };
  const key = `mrf:decisions:${changeset.base.edition}:${changeset.base.registry}:2`;

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ changesets: ["subjects.json"] }),
      text: () => Promise.resolve(JSON.stringify(changeset)),
      url,
    })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const load = async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "subjects.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "subjects.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
  };
  const stored = () => JSON.parse(window.localStorage.getItem(key) ?? "{}");

  it("records the person's first candidate and the rename's new_id on accept", async () => {
    await load();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept selected" }));
    expect(stored()[person.id]).toEqual({ decision: "accept", target: "Q1" });
    expect(stored()[rename.uid]).toEqual({ decision: "accept", target: rename.new_id });
  });

  it("stores no target for an edit", async () => {
    await load();
    fireEvent.click(screen.getByLabelText(/Fictinus Q2/));
    fireEvent.click(screen.getByRole("button", { name: "Accept (edited)" }));
    expect(stored()[person.id]).toEqual({ decision: "edit", edited: { wikidata: "Q2" } });
    expect(stored()[person.id]).not.toHaveProperty("target");
  });
});

describe("ReviewPage pre-filled only filter", () => {
  const place = (la: string, extra: object = {}) => ({
    op: "resolve_place", id: la, la, it: [], occurrences: [], claims: [], failed: [], candidates: [], decision: null, edited: null, ...extra,
  });
  const load = async (operations: unknown[], file: string) => {
    const set = { schema: "crmedr-changeset/v1", generated_by: "t", base: { edition: "2004", registry: "data/places.json" }, operations };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true, json: () => Promise.resolve({ changesets: [file] }), text: () => Promise.resolve(JSON.stringify(set)), url,
    })));
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: file })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: file } });
  };
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("lists only the pre-filled cards when the box is checked", async () => {
    await load([place("Fictopolis", { prefilled: "jev" }), place("Utopia")], "pf.json");
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    fireEvent.click(screen.getByLabelText("Pre-filled only"));
    expect(screen.getAllByTestId(/^op-card-/).map((el) => el.getAttribute("data-testid"))).toEqual(["op-card-Fictopolis"]);
  });

  it("clears the box when another change-set loads", async () => {
    const sets: Record<string, unknown[]> = {
      "a.json": [place("Fictopolis", { prefilled: "jev" }), place("Utopia")],
      "b.json": [place("Arcadia", { prefilled: "jev" }), place("Erewhon")],
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      const file = Object.keys(sets).find((f) => url.endsWith(f));
      const set = { schema: "crmedr-changeset/v1", generated_by: "t", base: { edition: "2004", registry: "data/places.json" }, operations: file ? sets[file] : [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ changesets: Object.keys(sets) }), text: () => Promise.resolve(JSON.stringify(set)), url });
    }));
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "a.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "a.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    fireEvent.click(screen.getByLabelText("Pre-filled only"));
    expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "b.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    expect(screen.getByLabelText("Pre-filled only")).not.toBeChecked();
  });

  it("finds a card by a eulogy it occurs in, beyond the first page", async () => {
    const many = Array.from({ length: 80 }, (_, i) => place(`Fictopoli ${i}`, { occurrences: [`mr:0101-x${i}`] }));
    many.push(place("monastérii Dalmátii nuncupáti", { occurrences: ["mr:0606-hilarion"] }));
    await load(many, "many.json");
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(50));
    fireEvent.change(screen.getByLabelText("ID contains"), { target: { value: "mr:0606-hilarion" } });
    expect(screen.getAllByTestId(/^op-card-/).map((el) => el.getAttribute("data-testid")))
      .toEqual(["op-card-monastérii Dalmátii nuncupáti"]);
  });

  it("still finds a card by its own ID", async () => {
    await load([place("Fictopolis", { occurrences: ["mr:0101-x"] }), place("Utopia")], "own.json");
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("ID contains"), { target: { value: "Utop" } });
    expect(screen.getAllByTestId(/^op-card-/).map((el) => el.getAttribute("data-testid"))).toEqual(["op-card-Utopia"]);
  });

  it("offers no box when no card is pre-filled", async () => {
    await load([place("Fictopolis"), place("Utopia")], "plain.json");
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    expect(screen.queryByLabelText("Pre-filled only")).not.toBeInTheDocument();
  });
});

describe("ReviewPage with a bundle missing from the index", () => {
  const key = "mrf:decisions:martyrologium_romanum_2004:data/test.json:1";
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(key, JSON.stringify({ "p|A": { decision: "accept", target: "Q1" } }));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ changesets: ["persons-review-02.json"] }),
      text: () => Promise.resolve("{}"),
      url,
    })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("missing bundle with stored decisions: renders the picker with the bundles that are listed", async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "persons-review-02.json" })).toBeInTheDocument());
    expect(screen.getByLabelText(/bundled change-set/i)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "persons-review-01.json" })).not.toBeInTheDocument();
  });
});
