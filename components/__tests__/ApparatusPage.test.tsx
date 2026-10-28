import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/intl";
import ApparatusPage from "@/components/ApparatusPage";
import styles from "@/components/page.module.css";
import * as api from "@/lib/api";
import type { MonthOut } from "@/lib/types";

vi.mock("@/data/misprints-snapshot.json", () => ({
  default: [
    { id: "mr:0801-fictus", edition: "martyrologium_romanum_2004_it_IT", printed: "e maria", intended: "e Maria", footnote: 1 },
    { id: "mr:0802-falsus", edition: "martyrologium_romanum_2004_it_IT", printed: "Fittiza", intended: "Fittizia" },
  ],
}));

const month = (mm: number, elogia: MonthOut["days"][string]["elogia"] = [], access: string | null = null): MonthOut => ({
  metadata: { edition: "martyrologium_romanum_2004", month: mm, access },
  days: elogia.length ? { "04": { titulus: null, elogia, conclusio: null } } : {},
});

describe("ApparatusPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("links to the index of names only for an edition with persons", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) => month(Number(mm)));
    const { unmount } = render(<ApparatusPage edition="martyrologium_romanum_2004" />);
    expect(await screen.findByRole("link", { name: "Index of names" })).toHaveAttribute(
      "href", "/en/read/martyrologium_romanum_2004/names",
    );
    unmount();
    render(<ApparatusPage edition="martyrologium_romanum_1749" />);
    await screen.findByRole("link", { name: "Index of places" });
    expect(screen.queryByRole("link", { name: "Index of names" })).toBeNull();
  });

  it("links to the edition's index of places", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) => month(Number(mm)));
    render(<ApparatusPage edition="martyrologium_romanum_2004" />);
    expect(await screen.findByRole("link", { name: "Index of places" })).toHaveAttribute(
      "href", "/en/read/martyrologium_romanum_2004/places",
    );
  });

  it("keeps the reader's day and comparison it was opened from on its links, back to the reader included", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 1
        ? month(1, [{ id: "mr:0104-abrunculus-lingonensis", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Treviris sancti Abrunculi." }])
        : month(Number(mm)),
    );
    const back = { day: { mm: 10, dd: 2 }, with: "martyrologium_romanum_1914_en_unofficial" };
    const q = "?day=10-02&with=martyrologium_romanum_1914_en_unofficial";
    render(<ApparatusPage edition="martyrologium_romanum_2004" back={back} />);
    expect(await screen.findByRole("link", { name: "⟵ Read the edition" }))
      .toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/10/02?with=martyrologium_romanum_1914_en_unofficial");
    expect(screen.getByRole("link", { name: "Index of places" })).toHaveAttribute("href", `/en/read/martyrologium_romanum_2004/places${q}`);
    expect(screen.getByRole("link", { name: "Index of names" })).toHaveAttribute("href", `/en/read/martyrologium_romanum_2004/names${q}`);
    expect(await screen.findByRole("link", { name: "4 January" })).toHaveAttribute(
      "href", "/en/read/martyrologium_romanum_2004/01/04?with=martyrologium_romanum_1914_en_unofficial#mr:0104-abrunculus-lingonensis",
    );
  });

  it("prints each eulogy's number with this edition's asterisk", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 1
        ? month(1, [{ id: "mr:0104-abrunculus-lingonensis", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Treviris sancti Abrunculi." }])
        : month(Number(mm)),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004" />);
    const text = await screen.findByText("Treviris sancti Abrunculi.", { exact: false });
    expect(text.closest("p")).toHaveTextContent(/^2\*\.\s*Treviris/);
  });

  it("shows the number and asterisk beside the day when the text is not available", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 1
        ? month(1, [{ id: "mr:0104-abrunculus-lingonensis", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: null }], "restricted-texts")
        : month(Number(mm), [], "restricted-texts"),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004" />);
    const id = await screen.findByText("mr:0104-abrunculus-lingonensis");
    expect(id.closest("p")).toHaveTextContent("2*.");
  });

  it("names the months and days in the reader's language, as its sections' accessible names do", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 1
        ? month(1, [{ id: "mr:0104-abrunculus-lingonensis", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Treviris sancti Abrunculi." }])
        : month(Number(mm)),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004" />, { locale: "it" });
    const section = await screen.findByRole("region", { name: "gennaio" });
    expect(section.querySelector("h2")).toHaveTextContent("gennaio");
    expect(screen.getByRole("link", { name: "4 gennaio" })).toHaveAttribute("href", "/it/read/martyrologium_romanum_2004/01/04#mr:0104-abrunculus-lingonensis");
  });

  it("highlights the sic! note in the eulogy's text, where the reader keeps it plain", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 8
        ? month(8, [{ id: "mr:0802-falsus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "08-02", text: "A Roma, santa Fittiza." }])
        : month(Number(mm)),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004_it_IT" />);
    const text = await screen.findByText(/A Roma, santa Fittiza/);
    const note = [...text.querySelectorAll("span")].find((s) => s.textContent?.includes("sic!"))!;
    expect(note).toHaveTextContent("[sic! expected: Fittizia]");
    expect(note).toHaveClass(styles.sicMarked);
    expect(note).not.toHaveClass(styles.sic);
  });

  it("lists a misprint in a footnote with the footnote's printed mark", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 8
        ? month(8, [{
            id: "mr:0801-fictus", entry: 1, asterisk: false, unnumbered: false, anchor_day: "08-01", text: "A Roma, beati Fittizio e compagni.",
            footnotes: [{ mark: "32", after: "compagni", text: "Fittizio, Caio e maria." }],
          }])
        : month(Number(mm)),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004_it_IT" />);
    const item = await screen.findByText(/Misprint in footnote 32:/);
    expect(item.closest("li")).toHaveTextContent("Misprint in footnote 32: e maria, sic! expected: e Maria");
  });
});
