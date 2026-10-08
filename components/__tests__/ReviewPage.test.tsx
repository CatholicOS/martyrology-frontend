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
