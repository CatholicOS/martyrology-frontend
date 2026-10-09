import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";
import type { CommonsImage, Entity } from "@/lib/entities";

const { state, request } = vi.hoisted(() => ({ state: { current: { status: "idle" } as EntityState }, request: vi.fn() }));
vi.mock("@/lib/entities-client", () => ({ useEntity: () => state.current, requestEntities: request }));

import MentionPersonCard from "@/components/markup/MentionPersonCard";
import type { PlacedMention } from "@/lib/mentions";

const basil: PlacedMention = {
  kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: "Q19546",
  key: "mr:0101-basilius|text|40", eulogy: "mr:0101-basilius",
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
} satisfies Entity;
const withImage = (image: CommonsImage | null) =>
  ({ status: "ready", entity: { ...BASIL, details: { ...BASIL.details, image } } }) satisfies EntityState;
const card = (m = basil, locale: "en" | "it" | "de" = "en") =>
  render(<MentionPersonCard mention={m} headingId="h" />, { locale });

describe("MentionPersonCard", () => {
  beforeEach(() => {
    state.current = { status: "ready", entity: BASIL };
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
});
