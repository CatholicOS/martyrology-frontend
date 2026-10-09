import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";

// Leaflet's module is evaluated the first time anything imports it: the count says when. A plain count, not a
// spy, because the mocks' calls are cleared before each test, which would hide a load made by the file's imports.
const { leaflet, mapMade } = vi.hoisted(() => ({ leaflet: { loads: 0 }, mapMade: vi.fn() }));
vi.mock("leaflet", () => {
  leaflet.loads++;
  const layer = { addTo: () => layer };
  const L = {
    map: () => { mapMade(); return { setView: vi.fn(), remove: vi.fn() }; },
    tileLayer: () => layer,
    circleMarker: () => layer,
  };
  return { default: L, ...L };
});
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children }: { href: string | { pathname: string }; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname}>{children}</a>
  ),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/snapshot", () => ({ getSnapshot: () => ({}) }));
vi.mock("@/lib/api", () => ({ getDay: vi.fn(), getEditions: vi.fn(), getAccess: vi.fn(), getCatalog: vi.fn(), ApiError: Error }));
vi.mock("@/lib/entities-client", () => ({
  useEntity: (): EntityState => ({
    status: "ready",
    entity: { kind: "place", labels: { en: "Rome" }, label: "Rome", country: "IT", coords: [41.9, 12.5] },
  }),
  requestEntities: vi.fn(),
  usePrefetchEntities: vi.fn(),
}));

import Reader, { __resetReaderState } from "@/components/Reader";
import { getAccess, getCatalog, getDay, getEditions } from "@/lib/api";
import type { DayOut, EditionOut } from "@/lib/types";

const EDITION = "martyrologium_romanum_2004";
const DAY: DayOut = {
  titulus: "",
  elogia: [{
    id: "mr:1002-modestus-sardus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "10-02",
    text: "Romae passio sancti Modesti Sardi.",
    mentions: [{ kind: "place", where: "text", start: 0, end: 5, form: "Romae", name: null, qid: "Q220" }],
  }],
  conclusio: null,
  metadata: { edition: EDITION, month: 10, day: 2, access: "public" },
};
const BOOK: EditionOut = {
  edition_id: EDITION, year: 2004, locale: "la", nature: "editio_typica_altera", book: "martyrologium", scope: {},
  promulgation: {}, governance: { governing_body: "", type: "" }, availability: { status: "public" },
};

describe("the reader's markup", () => {
  beforeEach(() => {
    __resetReaderState();
    window.localStorage.setItem("reader.markup", "1");
    vi.mocked(getDay).mockResolvedValue(DAY);
    vi.mocked(getEditions).mockResolvedValue([BOOK]);
    vi.mocked(getAccess).mockResolvedValue({ [EDITION]: { can_read_texts: true } });
    vi.mocked(getCatalog).mockResolvedValue([]);
  });

  it("loads Leaflet only when a place popup opens", async () => {
    render(<Reader edition={EDITION} mm={10} dd={2} signedIn={false} />);
    const rome = await screen.findByRole("button", { name: "Romae" });
    expect(leaflet.loads).toBe(0);
    fireEvent.click(rome);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(mapMade).toHaveBeenCalled());
    expect(leaflet.loads).toBe(1);
  });
});

/** The modules `file` imports (statically, re-exported or lazily), resolved to files; `import type` is left out. */
function imports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs = [
    ...src.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^;]*?\bfrom\s+"([^"]+)"/gm),
    ...src.matchAll(/^\s*import\s+"([^"]+)"/gm),
    ...src.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g),
  ].map((m) => m[1]);
  return specs.flatMap((s) => {
    const base = s.startsWith("@/") ? s.slice(2) : s.startsWith(".") ? normalize(join(dirname(file), s)) : null;
    if (base === null) return []; // a package
    const found = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((x) => base + x).find((f) => statSync(f, { throwIfNoEntry: false })?.isFile());
    return found && !found.endsWith(".css") ? [found] : [];
  });
}

describe("the reader's client code", () => {
  it("never imports a persons, places or person-details snapshot, however far down", () => {
    const SERVER_ONLY = /^(data\/(persons|places|person-details)-snapshot\.json|lib\/(persons|places|person-details)\.ts)$/;
    const seen = new Set<string>();
    const reached: string[] = [];
    const walk = (f: string, from: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      if (SERVER_ONLY.test(f)) reached.push(`${from} → ${f}`);
      if (/\.tsx?$/.test(f)) for (const g of imports(f)) walk(g, f);
    };
    walk("components/Reader.tsx", "");
    expect(seen.has("components/markup/MentionPlaceCard.tsx")).toBe(true); // the walk reaches the popups
    expect(reached).toEqual([]);
  });
});
