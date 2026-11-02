import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/intl";
import type { Entity } from "@/lib/entities";
import type { EntityState } from "@/lib/entities-client";

const { state } = vi.hoisted(() => ({ state: { current: { status: "idle" } as EntityState } }));
vi.mock("@/lib/entities-client", () => ({ useEntity: () => state.current, requestEntities: vi.fn() }));

import MentionEventCard from "@/components/markup/MentionEventCard";
import type { PlacedMention } from "@/lib/mentions";

const council: PlacedMention = {
  kind: "event", where: "text", start: 0, end: 17, form: "Concílio Ephesíno", name: null, qid: "Q184332",
  key: "ed|mr:0101-maria-dei-genetrix|text|0", group: "mr:0101-maria-dei-genetrix|event|Q184332",
  groups: ["mr:0101-maria-dei-genetrix|event|Q184332"], eulogy: "mr:0101-maria-dei-genetrix",
};
const year = (y: number) => ({ year: y, precision: "year" as const, circa: false });
const EPHESUS: Entity = {
  kind: "event",
  labels: { la: "Concilium Ephesinum", en: "First Council of Ephesus", it: "Concilio di Efeso" },
  description: { en: "ecumenical council in Ephesus in June–July 431", it: "III concilio ecumenico" },
  start: year(431), end: year(431),
  place: { qid: "Q47611", labels: { en: "Ephesus", it: "Efeso" }, label: "Ephesus" },
  wikipedia: { en: "Council of Ephesus", it: "Concilio di Efeso" },
};
const card = (locale: "en" | "it" | "de" = "en", m = council) =>
  render(<MentionEventCard mention={m} lang="la" headingId="h" />, { locale });

describe("MentionEventCard", () => {
  beforeEach(() => {
    state.current = { status: "ready", entity: EPHESUS };
  });

  it("names the event in the interface language, with the printed form tagged, its year, place and description", () => {
    card("it");
    expect(screen.getByRole("heading")).toHaveTextContent("Concilio di Efeso");
    expect(screen.getByText("Concílio Ephesíno")).toHaveAttribute("lang", "la");
    // The place is tagged with its own language: the line reads whole.
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "431 · Efeso")).toBeInTheDocument();
    expect(screen.getByText("III concilio ecumenico")).toBeInTheDocument();
  });

  it("links to Wikipedia in the interface language and to Wikidata", () => {
    card("it");
    expect(screen.getByRole("link", { name: "Wikipedia" })).toHaveAttribute("href", "https://it.wikipedia.org/wiki/Concilio_di_Efeso");
    expect(screen.getByRole("link", { name: "Wikidata" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q184332");
  });

  it("falls back to the Latin label, then the English, each tagged; no Wikipedia link without an article in the language", () => {
    card("de");
    expect(screen.getByRole("heading")).toHaveTextContent("Concilium Ephesinum");
    expect(screen.getByText("Concilium Ephesinum")).toHaveAttribute("lang", "la");
    expect(screen.queryByRole("link", { name: "Wikipedia" })).toBeNull();
    state.current = { status: "ready", entity: { ...EPHESUS, labels: { en: "First Council of Ephesus" } } };
    card("de");
    expect(screen.getByText("First Council of Ephesus")).toHaveAttribute("lang", "en");
  });

  it("gives a span of years, and no place when the event has none", () => {
    state.current = { status: "ready", entity: { ...EPHESUS, start: year(1545), end: year(1563), place: null } };
    card();
    expect(screen.getByText("1545 – 1563")).toBeInTheDocument();
  });

  it("when the details fail: the printed form, the notice, and still the Wikidata link", () => {
    state.current = { status: "error" };
    card();
    expect(screen.getByRole("heading")).toHaveTextContent("Concílio Ephesíno");
    expect(screen.getByText(/Details unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wikidata" })).toBeInTheDocument();
  });
});
