import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/intl";
import ApparatusPage from "@/components/ApparatusPage";
import * as api from "@/lib/api";
import type { MonthOut } from "@/lib/types";

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

  it("prints each eulogy's number with this edition's asterisk", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 1
        ? month(1, [{ id: "mr:0104-abrunculus", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Treviris sancti Abrunculi." }])
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
        ? month(1, [{ id: "mr:0104-abrunculus", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: null }], "restricted-texts")
        : month(Number(mm), [], "restricted-texts"),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004" />);
    const id = await screen.findByText("mr:0104-abrunculus");
    expect(id.closest("p")).toHaveTextContent("2*.");
  });

  it("names the months and days in the reader's language, as its sections' accessible names do", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) =>
      Number(mm) === 1
        ? month(1, [{ id: "mr:0104-abrunculus", entry: 2, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Treviris sancti Abrunculi." }])
        : month(Number(mm)),
    );
    render(<ApparatusPage edition="martyrologium_romanum_2004" />, { locale: "it" });
    const section = await screen.findByRole("region", { name: "gennaio" });
    expect(section.querySelector("h2")).toHaveTextContent("gennaio");
    expect(screen.getByRole("link", { name: "4 gennaio" })).toHaveAttribute("href", "/it/read/martyrologium_romanum_2004/01/04#mr:0104-abrunculus");
  });
});
