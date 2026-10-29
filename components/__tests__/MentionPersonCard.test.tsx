import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";
import type { CommonsImage, Entity } from "@/lib/entities";

const { state, request } = vi.hoisted(() => ({ state: { current: { status: "idle" } as EntityState }, request: vi.fn() }));
vi.mock("@/lib/entities-client", () => ({ useEntity: () => state.current, requestEntities: request }));
const { printed } = vi.hoisted(() => ({ printed: { current: {} as Record<string, Record<string, { day_printed: string }>> } }));
vi.mock("@/lib/use-placements", () => ({
  usePlacements: (ids: string[]) => Object.fromEntries(ids.flatMap((id) => (printed.current[id] ? [[id, printed.current[id]]] : []))),
}));

import MentionPersonCard from "@/components/markup/MentionPersonCard";
import type { PlacedMention } from "@/lib/mentions";
import type { ReaderPage } from "@/components/markup/Markup";

const basil: PlacedMention = {
  kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: "Q19546",
  key: "mr:0101-basilius|text|40", group: "mr:0101-basilius|text|person|Basilius#1", eulogy: "mr:0101-basilius",
};
const BASIL = {
  kind: "person",
  labels: { en: "Basil of Caesarea", it: "Basilio di Cesarea" },
  details: {
    description: { en: "Greek bishop and Doctor of the Church" },
    born: { year: 329, precision: "year", circa: false },
    died: { year: 379, precision: "year", circa: false },
    image: { file: "Basil of Caesarea.jpg", author: "Anonymous", license: "Public domain", license_url: null },
    wikipedia: { it: "Basilio di Cesarea" },
  },
  eulogies: [],
} satisfies Entity;
const withImage = (image: CommonsImage | null) =>
  ({ status: "ready", entity: { ...BASIL, details: { ...BASIL.details, image } } }) satisfies EntityState;
const card = (m = basil, locale: "en" | "it" | "de" = "en", page: ReaderPage = { edition: "martyrologium_romanum_2004", with: null }) =>
  render(<MentionPersonCard mention={m} page={page} headingId="h" />, { locale });
const subject = (en: string) => ({ la: `la ${en}`, it: `it ${en}`, en });
const AGATHA = {
  ...BASIL,
  eulogies: [
    { id: "mr:0109-agatha-yi-et-teresia-kim", month: 1, day: 9, subject: subject("Saints Agatha Yi and Teresa Kim"), own: true },
    { id: "mr:0101-basilius", month: 1, day: 1, subject: subject("Saint Basil"), own: false },
    { id: "mr:0920-andreas-kim-tae-gon-et-socii", month: 9, day: 20, subject: subject("Saints Andrew Kim and companions"), own: false },
  ],
} satisfies Entity;

/** Where the editions print AGATHA's eulogies: both 2004 editions, on their days. */
const PRINTED = Object.fromEntries(AGATHA.eulogies.map((e) => {
  const day = { day_printed: `${String(e.month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}` };
  return [e.id, { martyrologium_romanum_2004: day, martyrologium_romanum_2004_it_IT: day }];
}));

describe("MentionPersonCard", () => {
  beforeEach(() => {
    state.current = { status: "ready", entity: BASIL };
    printed.current = PRINTED;
    request.mockReset();
  });

  it("names the person in the interface language, with years, description, portrait and links", () => {
    card(basil, "it");
    expect(screen.getByRole("heading", { name: "Basilio di Cesarea" })).not.toHaveAttribute("lang");
    expect(screen.getByText("329 – 379")).toBeInTheDocument();
    expect(screen.getByText("Greek bishop and Doctor of the Church")).toHaveAttribute("lang", "en");
    const img = screen.getByRole("img", { name: "Ritratto di Basilio di Cesarea" });
    expect(img).toHaveAttribute("src", "https://commons.wikimedia.org/wiki/Special:FilePath/Basil_of_Caesarea.jpg?width=96");
    expect(img).not.toHaveAttribute("loading");
    expect(img).toHaveAttribute("height", "120");
    const author = screen.getByRole("link", { name: "Anonymous" });
    expect(author).toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Basil_of_Caesarea.jpg");
    expect(author).toHaveAttribute("target", "_blank");
    expect(author).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/Public domain/)).toBeInTheDocument();
    const wikipedia = screen.getByRole("link", { name: "Wikipedia" });
    expect(wikipedia).toHaveAttribute("href", "https://it.wikipedia.org/wiki/Basilio_di_Cesarea");
    expect(wikipedia).toHaveAttribute("rel", "noopener noreferrer");
    const wikidata = screen.getByRole("link", { name: "Wikidata" });
    expect(wikidata).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q19546");
    expect(wikidata).toHaveAttribute("target", "_blank");
    expect(wikidata).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("writes the life dates as the messages do: only a death, only a birth", () => {
    state.current = { status: "ready", entity: { ...BASIL, details: { ...BASIL.details, born: null, died: { year: 258, precision: "year", circa: false } } } };
    const { unmount } = card();
    expect(screen.getByText("d. 258")).toBeInTheDocument();
    unmount();
    state.current = { status: "ready", entity: { ...BASIL, details: { ...BASIL.details, died: null, born: { year: 1900, precision: "year", circa: false } } } };
    card();
    expect(screen.getByText("b. 1900")).toBeInTheDocument();
  });

  it("credits a portrait without a known author by its license alone, linked to its license page", () => {
    state.current = withImage({ file: "Basil.jpg", author: null, license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0" });
    const { container } = card();
    expect(container.querySelector("figcaption")!.textContent).toBe("CC BY-SA 4.0");
    const license = screen.getByRole("link", { name: "CC BY-SA 4.0" });
    expect(license).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0");
    expect(license).toHaveAttribute("target", "_blank");
    expect(license).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names a license without a link as plain text", () => {
    const { container } = card();
    expect(container.querySelector("figcaption")!.textContent).toBe("Anonymous · Public domain");
    expect(screen.queryByRole("link", { name: "Public domain" })).toBeNull();
  });

  it("does not link a license address that is not http(s)", () => {
    state.current = withImage({ file: "Basil.jpg", author: null, license: "Odd", license_url: "javascript:alert(1)" });
    const { container } = card();
    expect(container.querySelector("figcaption")!.textContent).toBe("Odd");
    expect(screen.queryByRole("link", { name: "Odd" })).toBeNull();
  });

  it("shows no portrait when Wikidata has none", () => {
    state.current = withImage(null);
    card();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("figure")).toBeNull();
  });

  it("falls back to the English name, tagged, and offers no Wikipedia article in another language", () => {
    card(basil, "de");
    expect(screen.getByRole("heading", { name: "Basil of Caesarea" })).toHaveAttribute("lang", "en");
    expect(screen.queryByRole("link", { name: "Wikipedia" })).toBeNull();
  });

  it("a QID the snapshots don't know: the Latin name, tagged, and Wikidata", () => {
    state.current = { status: "ready", entity: null };
    card();
    expect(screen.getByRole("heading", { name: "Basilius" })).toHaveAttribute("lang", "la");
    expect(screen.getByRole("link", { name: "Wikidata" })).toBeInTheDocument();
    expect(screen.queryByText("Details unavailable.")).toBeNull();
  });

  it("a person not yet linked: the Latin name, the notice and the eulogy's ID", () => {
    card({ ...basil, qid: null });
    expect(screen.getByRole("heading", { name: "Basilius" })).toHaveAttribute("lang", "la");
    expect(screen.getByText("Not yet linked to Wikidata")).toBeInTheDocument();
    expect(screen.getByText("mr:0101-basilius")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Wikidata" })).toBeNull();
  });

  it("when the details fail: the printed name, the notice and a retry", () => {
    state.current = { status: "error" };
    card();
    expect(screen.getByRole("heading", { name: "Basilius" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(request).toHaveBeenCalledWith(["Q19546"]);
  });

  it("says it is loading while the details are on their way", () => {
    state.current = { status: "loading" };
    card();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("links the other eulogies that name the person, after Wikidata's details, leaving out this one", () => {
    state.current = { status: "ready", entity: AGATHA };
    card();
    expect(screen.getByText("Greek bishop and Doctor of the Church")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wikidata" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Other eulogies" });
    const links = within(list).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/en/read/martyrologium_romanum_2004/01/09#mr:0109-agatha-yi-et-teresia-kim",
      "/en/read/martyrologium_romanum_2004/09/20#mr:0920-andreas-kim-tae-gon-et-socii",
    ]);
    expect(links[0]).toHaveTextContent("9 January");
    expect(within(list).getByText("Saints Agatha Yi and Teresa Kim")).not.toHaveAttribute("lang");
    expect(screen.queryByText("Saint Basil")).toBeNull();
  });

  it("opens them in the reader's edition, with its comparison, and the subject in the interface language", () => {
    state.current = { status: "ready", entity: AGATHA };
    card(basil, "it", { edition: "martyrologium_romanum_2004_it_IT", with: "martyrologium_romanum_2004" });
    const link = screen.getAllByRole("link").find((a) => a.getAttribute("href")?.includes("#mr:0109"))!;
    expect(link).toHaveAttribute("href",
      "/it/read/martyrologium_romanum_2004_it_IT/01/09?with=martyrologium_romanum_2004#mr:0109-agatha-yi-et-teresia-kim");
    expect(screen.getByText("it Saints Agatha Yi and Teresa Kim")).not.toHaveAttribute("lang");
  });

  it("tags the English subject in an interface language crmedr has no subjects in", () => {
    state.current = { status: "ready", entity: AGATHA };
    card(basil, "de");
    expect(screen.getByText("Saints Agatha Yi and Teresa Kim")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("list", { name: "Weitere Elogien" })).toBeInTheDocument();
  });

  it("opens a eulogy the reader's edition does not print in its comparison, on the day that edition prints it", () => {
    state.current = { status: "ready", entity: AGATHA };
    printed.current = { ...PRINTED, "mr:0109-agatha-yi-et-teresia-kim": { martyrologium_romanum_2004: { day_printed: "01-10" } } };
    card(basil, "en", { edition: "martyrologium_romanum_1749", with: "martyrologium_romanum_2004" });
    const links = within(screen.getByRole("list", { name: "Other eulogies" })).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href",
      "/en/read/martyrologium_romanum_1749/01/10?with=martyrologium_romanum_2004#mr:0109-agatha-yi-et-teresia-kim");
    expect(links[0]).toHaveTextContent("10 January");
  });

  it("leaves out a eulogy neither edition of the page prints, and one whose placements are not known yet", () => {
    state.current = { status: "ready", entity: AGATHA };
    printed.current = { "mr:0920-andreas-kim-tae-gon-et-socii": PRINTED["mr:0920-andreas-kim-tae-gon-et-socii"] };
    card(basil, "en", { edition: "martyrologium_romanum_1749", with: null });
    expect(screen.queryByRole("list")).toBeNull();
    printed.current = { "mr:0109-agatha-yi-et-teresia-kim": {} };
    card();
    expect(screen.queryAllByRole("list")).toHaveLength(0);
  });

  it("shows no list when no other eulogy names the person", () => {
    state.current = { status: "ready", entity: { ...AGATHA, eulogies: [AGATHA.eulogies[1]] } };
    card();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
