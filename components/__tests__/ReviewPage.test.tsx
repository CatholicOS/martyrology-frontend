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
