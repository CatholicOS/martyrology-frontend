# Martyrology Curation Frontend (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js curation website that (1) compares two Roman Martyrology editions side by side, organized by physical day and aligned by canonical ID with RED/GREEN deprecated-diff highlighting, and (2) reviews a Claude-Code change-set against the real eulogy text with Accept/Reject/Edit and JSON export.

**Architecture:** Next.js 16 App Router app. The browser talks only to a server-side proxy route (`/api/mr/[...path]` → `${API_BASE}/api/v1/...`), avoiding CORS. A bundled CRMEDR registry+subjects snapshot supplies `deprecated`, `country`, and per-language subjects. Change-sets follow `crmedr-changeset/v1` and live in `data/changesets/`. All eulogy TEXT comes from the live API at runtime; only public IDs/subjects/placement are bundled.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4, Vitest + React Testing Library, npm.

## Global Constraints

- **Next.js 16 App Router + React 19 + TypeScript strict + Tailwind v4 + npm** — match `cdcf-website` conventions.
- **The browser never calls `martyrology-api` directly.** All API access goes through the Next.js proxy route `app/api/mr/[...path]/route.ts` → `${API_BASE}/api/v1/${path}`. `API_BASE` env, default `http://localhost:8000`.
- **API base path is `/api/v1`.** Endpoints: `GET /editions`; `GET /elogia?edition={id}&locale={la|it|en}`; `GET /elogium/{canonical_id}`; `GET /elogia/edition/{edition}/{MM}/{DD}`.
- **API response shapes (verbatim, from martyrology-api `models.py`):**
  - `EditionsOut { editions: EditionOut[] }`, `EditionOut { edition_id, book, year, nature, scope, locale, promulgation, predecessor?, successor?, governance{governing_body,type,nation?}, availability{status,note?}, aligned? }`.
  - `CatalogOut { elogia: CatalogEntryOut[] }`, `CatalogEntryOut { id, subject:string|null, anchor_day:"MM-DD", deprecated:boolean, present?:boolean, day_printed?:"MM-DD", entry?:number }` — `present/day_printed/entry` are filled only when `edition=` is passed.
  - `EulogyOut { id, subject:{[lang]:string}, anchor_day:"MM-DD", deprecated, editions:{[edition_id]: { day_printed, entry, asterisk, unnumbered, text:string|null }} }`.
  - `DayContentOut { titulus:string|null, elogia: ElogiumOut[], conclusio:string|null }`, `ElogiumOut { id:string|null, entry:number|null, asterisk, unnumbered, anchor_day:"MM-DD", text:string|null }`.
- **`day_printed` is the physical day; `anchor_day` is the ID's MMDD anchor.** Compare groups by `day_printed`; an entry with `anchor_day !== day_printed` is a cross-day anomaly (flag it, do not hide it).
- **Change-set schema `crmedr-changeset/v1`** exactly as in the design spec; ops `rename`/`delete`/`merge` are adjudicable; unknown ops render read-only. `decision ∈ {null,"accept","reject","edit"}`; `edited` holds `{new_id?, subject_la?}` when `decision==="edit"`.
- **Only public data is bundled** (`data/registry-snapshot.json`, `data/changesets/*.json`). Never bundle eulogy text; it is fetched live.
- **Tests never hit the network** — mock `fetch`/the api client.
- **Node scripts are ESM `.mjs`, stdlib/Node-only, no new deps.**

---

## File Structure

- `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `.gitignore` — scaffold/config.
- `app/layout.tsx`, `app/globals.css`, `app/page.tsx` — shell + home.
- `app/api/mr/[...path]/route.ts` — server proxy to the API.
- `app/compare/page.tsx`, `app/review/page.tsx` — the two views (client components).
- `lib/types.ts` — TypeScript mirrors of API models + snapshot + change-set types.
- `lib/api.ts` — typed client over the proxy.
- `lib/snapshot.ts` — typed loader for the bundled registry snapshot.
- `lib/changeset.ts` — change-set parse/validate + decision-apply/export helpers.
- `lib/compare.ts` — pure edition-comparison/alignment logic.
- `lib/decisions.ts` — localStorage-backed decision store.
- `components/…` — presentational components per view.
- `scripts/snapshot-registry.mjs` — build `data/registry-snapshot.json` from `../crmedr`.
- `scripts/import-changeset.mjs` — convert a CRMEDR manifest → `data/changesets/<name>.json`.
- `data/registry-snapshot.json`, `data/changesets/*.json` — bundled inputs (generated).

---

## Task 1: Repo scaffold (Next.js 16 + TS + Tailwind + Vitest)

**Files:** Create `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `vitest.setup.ts`, `.env.example`, `.gitignore`, `lib/__tests__/smoke.test.ts`.

**Interfaces:**
- Produces: a runnable Next.js app with `npm run dev`, `npm run build`, `npm test`, `npm run lint`; home page at `/` linking to `/compare` and `/review`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "martyrology-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "snapshot-registry": "node scripts/snapshot-registry.mjs",
    "import-changeset": "node scripts/import-changeset.mjs"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext", "moduleResolution": "bundler", "jsx": "preserve",
    "strict": true, "noEmit": true, "esModuleInterop": true, "skipLibCheck": true,
    "resolveJsonModule": true, "allowJs": true, "incremental": true,
    "paths": { "@/*": ["./*"] }, "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
`next.config.ts`: `import type { NextConfig } from "next"; const c: NextConfig = {}; export default c;`
`postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } };`
`.env.example`: `API_BASE=http://localhost:8000`
`.gitignore`: `node_modules`, `.next`, `.env*`, `!.env.example`, `*.tsbuildinfo`, `next-env.d.ts`, `coverage`.

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
```
`vitest.setup.ts`: `import "@testing-library/jest-dom/vitest";`

- [ ] **Step 3: App shell**

`app/globals.css`: `@import "tailwindcss";`
`app/layout.tsx`:
```tsx
import "./globals.css";
export const metadata = { title: "Martyrology Curation", description: "CRMEDR curation tool" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">{children}</body></html>);
}
```
`app/page.tsx`:
```tsx
import Link from "next/link";
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Martyrology Curation</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Review draft canonical IDs across editions of the Roman Martyrology.</p>
      <nav className="mt-6 flex gap-4">
        <Link href="/compare" className="rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900">Compare editions</Link>
        <Link href="/review" className="rounded border border-slate-300 px-4 py-2 dark:border-slate-700">Review change-set</Link>
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: Smoke test**

`lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("scaffold", () => { it("runs vitest", () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 5: Verify**

Run: `npm install && npm test && npm run build`
Expected: install succeeds, 1 test passes, `next build` completes with `/`, `/compare` (404 until Task 5) — build of `/` succeeds. (Create placeholder `app/compare/page.tsx` and `app/review/page.tsx` returning `<main>Coming soon</main>` so the build is clean; they are replaced in Tasks 5–6.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js 16 + TS + Tailwind + Vitest"
```

---

## Task 2: API types, proxy route, typed client

**Files:** Create `lib/types.ts`, `app/api/mr/[...path]/route.ts`, `lib/api.ts`, `lib/__tests__/api.test.ts`.

**Interfaces:**
- Produces:
  - `lib/types.ts`: `EditionOut`, `CatalogEntryOut`, `EulogyOut`, `DayContentOut`, `ElogiumOut` (mirroring the Global-Constraints shapes), plus `Locale = "la" | "it" | "en"`.
  - proxy `GET /api/mr/<path>` → forwards to `${API_BASE}/api/v1/<path>` preserving query string; returns the upstream JSON + status.
  - `lib/api.ts`: `getEditions(): Promise<EditionOut[]>`, `getCatalog(edition: string, locale: Locale): Promise<CatalogEntryOut[]>`, `getElogium(id: string, locale?: Locale): Promise<EulogyOut>`, `getDay(edition: string, mm: string, dd: string): Promise<DayContentOut>`. Each throws `ApiError { status, title }` on non-2xx.

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEditions, getCatalog, ApiError } from "@/lib/api";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("api client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("getEditions hits the proxy and unwraps editions[]", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockReturnValue(json({ editions: [{ edition_id: "x", year: 1749 }] }) as never);
    const eds = await getEditions();
    expect(spy).toHaveBeenCalledWith("/api/mr/editions", expect.anything());
    expect(eds[0].edition_id).toBe("x");
  });

  it("getCatalog passes edition + locale as query", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockReturnValue(json({ elogia: [] }) as never);
    await getCatalog("martyrologium_romanum_1749", "la");
    expect(spy).toHaveBeenCalledWith("/api/mr/elogia?edition=martyrologium_romanum_1749&locale=la", expect.anything());
  });

  it("throws ApiError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(json({ title: "Unknown edition" }, 404) as never);
    await expect(getCatalog("nope", "la")).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL — cannot resolve `@/lib/api`.

- [ ] **Step 3: Implement types, proxy, client**

`lib/types.ts`:
```ts
export type Locale = "la" | "it" | "en";
export interface EditionOut {
  edition_id: string; book: string; year: number; nature: string;
  scope: Record<string, unknown>; locale: string;
  promulgation: Record<string, unknown>;
  predecessor?: string | null; successor?: string | null;
  governance: { governing_body: string; type: string; nation?: string | null };
  availability: { status: string; note?: string | null };
  aligned?: boolean | null;
}
export interface CatalogEntryOut {
  id: string; subject: string | null; anchor_day: string; deprecated: boolean;
  present?: boolean; day_printed?: string | null; entry?: number | null;
}
export interface EditionPlacement { day_printed: string; entry: number | null; asterisk: boolean; unnumbered: boolean; text: string | null; }
export interface EulogyOut {
  id: string; subject: Record<string, string>; anchor_day: string; deprecated: boolean;
  editions: Record<string, EditionPlacement>;
}
export interface ElogiumOut { id: string | null; entry: number | null; asterisk: boolean; unnumbered: boolean; anchor_day: string; text: string | null; }
export interface DayContentOut { titulus: string | null; elogia: ElogiumOut[]; conclusio: string | null; }
```

`app/api/mr/[...path]/route.ts`:
```ts
import { NextRequest } from "next/server";
const API_BASE = process.env.API_BASE ?? "http://localhost:8000";
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const qs = req.nextUrl.search; // includes leading "?" or ""
  const url = `${API_BASE}/api/v1/${path.map(encodeURIComponent).join("/")}${qs}`;
  try {
    const upstream = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const body = await upstream.text();
    return new Response(body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch {
    return new Response(JSON.stringify({ title: "API unreachable", detail: `Could not reach ${API_BASE}` }), { status: 502, headers: { "content-type": "application/json" } });
  }
}
```

`lib/api.ts`:
```ts
import type { EditionOut, CatalogEntryOut, EulogyOut, DayContentOut, Locale } from "@/lib/types";
export class ApiError extends Error { constructor(public status: number, public title: string) { super(title); } }
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/mr/${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) { let title = res.statusText; try { title = (await res.json()).title ?? title; } catch {} throw new ApiError(res.status, title); }
  return res.json() as Promise<T>;
}
export async function getEditions(): Promise<EditionOut[]> { return (await get<{ editions: EditionOut[] }>("editions")).editions; }
export async function getCatalog(edition: string, locale: Locale): Promise<CatalogEntryOut[]> {
  return (await get<{ elogia: CatalogEntryOut[] }>(`elogia?edition=${encodeURIComponent(edition)}&locale=${locale}`)).elogia;
}
export async function getElogium(id: string, locale: Locale = "la"): Promise<EulogyOut> { return get<EulogyOut>(`elogium/${encodeURIComponent(id)}?locale=${locale}`); }
export async function getDay(edition: string, mm: string, dd: string): Promise<DayContentOut> { return get<DayContentOut>(`elogia/edition/${encodeURIComponent(edition)}/${mm}/${dd}`); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: API types, server proxy route, typed client"
```

---

## Task 3: Registry+subjects snapshot script + loader

**Files:** Create `scripts/snapshot-registry.mjs`, `lib/snapshot.ts`, `lib/__tests__/snapshot.test.ts`, and a small fixture under `lib/__tests__/fixtures/`.

**Interfaces:**
- Consumes: nothing from prior tasks (standalone).
- Produces:
  - `scripts/snapshot-registry.mjs` — reads `<crmedr>/data/martyrology_ids.json` + `<crmedr>/i18n/{la,it,en}.json` (crmedr path via `argv[2]`, default `../crmedr`) and writes `data/registry-snapshot.json` = `{ [id]: { deprecated, month, day, entry, asterisk, unnumbered, country, attested_in, subject: { la, it, en } } }`.
  - `lib/snapshot.ts` — `export type RegistrySnapshot = Record<string, SnapshotEntry>;` `export interface SnapshotEntry { deprecated: boolean; month: number; day: number; entry: number|null; asterisk: boolean; unnumbered: boolean; country: string|null; attested_in?: string|null; subject: { la: string; it: string; en: string } }` and `export async function loadSnapshot(): Promise<RegistrySnapshot>` importing the JSON.

- [ ] **Step 1: Write the failing test** (the snapshot builder is pure — test its transform)

```ts
// lib/__tests__/snapshot.test.ts
import { describe, it, expect } from "vitest";
import { buildSnapshot } from "@/scripts/snapshot-registry.mjs";

const registry = { entries: [
  { id: "mr:0104-titus", month: 1, day: 4, entry: 2, asterisk: false, country: "GR" },
  { id: "mr:0101-circumcisio-domini", month: 1, day: 1, entry: 1, deprecated: true, attested_in: "martyrologium_romanum_1749", country: null, unnumbered: true },
]};
const la = { "mr:0104-titus": "Sanctus Titus", "mr:0101-circumcisio-domini": "Circumcisio Domini" };
const it = { "mr:0104-titus": "", "mr:0101-circumcisio-domini": "" };
const en = { "mr:0104-titus": "Saint Titus", "mr:0101-circumcisio-domini": "" };

describe("buildSnapshot", () => {
  it("merges registry + i18n into per-id entries", () => {
    const snap = buildSnapshot(registry, la, it, en);
    expect(snap["mr:0104-titus"]).toEqual({
      deprecated: false, month: 1, day: 4, entry: 2, asterisk: false, unnumbered: false,
      country: "GR", attested_in: null, subject: { la: "Sanctus Titus", it: "", en: "Saint Titus" },
    });
    expect(snap["mr:0101-circumcisio-domini"].deprecated).toBe(true);
    expect(snap["mr:0101-circumcisio-domini"].attested_in).toBe("martyrologium_romanum_1749");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- snapshot`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the script (exporting `buildSnapshot` for tests) + loader**

`scripts/snapshot-registry.mjs`:
```js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function buildSnapshot(registry, la, it, en) {
  const out = {};
  for (const e of registry.entries) {
    out[e.id] = {
      deprecated: Boolean(e.deprecated),
      month: e.month, day: e.day,
      entry: e.entry ?? null,
      asterisk: Boolean(e.asterisk),
      unnumbered: Boolean(e.unnumbered),
      country: e.country ?? null,
      attested_in: e.attested_in ?? null,
      subject: { la: la[e.id] ?? "", it: it[e.id] ?? "", en: en[e.id] ?? "" },
    };
  }
  return out;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const crmedr = process.argv[2] ?? join(here, "..", "..", "crmedr");
  const registry = JSON.parse(readFileSync(join(crmedr, "data", "martyrology_ids.json"), "utf8"));
  const la = JSON.parse(readFileSync(join(crmedr, "i18n", "la.json"), "utf8"));
  const it = JSON.parse(readFileSync(join(crmedr, "i18n", "it.json"), "utf8"));
  const en = JSON.parse(readFileSync(join(crmedr, "i18n", "en.json"), "utf8"));
  const snap = buildSnapshot(registry, la, it, en);
  const dest = join(here, "..", "data", "registry-snapshot.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(snap) + "\n");
  console.log(`wrote ${dest}: ${Object.keys(snap).length} ids`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```

`lib/snapshot.ts`:
```ts
import snapshot from "@/data/registry-snapshot.json";
export interface SnapshotEntry {
  deprecated: boolean; month: number; day: number; entry: number | null;
  asterisk: boolean; unnumbered: boolean; country: string | null;
  attested_in?: string | null; subject: { la: string; it: string; en: string };
}
export type RegistrySnapshot = Record<string, SnapshotEntry>;
export function getSnapshot(): RegistrySnapshot { return snapshot as RegistrySnapshot; }
```

- [ ] **Step 4: Generate the real snapshot + run tests**

Run: `npm run snapshot-registry && npm test -- snapshot`
Expected: writes `data/registry-snapshot.json` (~6081 ids); test passes. (Commit the generated snapshot — it is a required bundled input.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: CRMEDR registry+subjects snapshot builder and loader"
```

---

## Task 4: Change-set schema, converter, loader/validator

**Files:** Create `lib/changeset.ts`, `scripts/import-changeset.mjs`, `lib/__tests__/changeset.test.ts`.

**Interfaces:**
- Produces:
  - `lib/changeset.ts`:
    - types `Decision = null | "accept" | "reject" | "edit"`, `Op = RenameOp | DeleteOp | MergeOp | UnknownOp`, `Changeset { schema:"crmedr-changeset/v1"; generated_by:string; generated_at?:string; base:{edition:string; registry:string}; operations: Op[] }`.
    - `parseChangeset(text: string): Changeset` (throws on wrong `schema`).
    - `opId(op: Op): string` (primary affected id, for keys), `isAdjudicable(op): boolean`.
    - `exportChangeset(cs: Changeset, decisions: Record<string, DecisionRecord>): Changeset` — returns a copy with `decision`/`edited` merged in, `generated_by:"curation-ui"`.
  - `scripts/import-changeset.mjs` — `convertManifest(manifest): Changeset` (CRMEDR `deprecated_id_corrections.json` → v1) + CLI writing `data/changesets/<name>.json`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/changeset.test.ts
import { describe, it, expect } from "vitest";
import { parseChangeset, exportChangeset, opId } from "@/lib/changeset";
import { convertManifest } from "@/scripts/import-changeset.mjs";

const manifest = [
  { old_id: "mr:0104-titi", new_id: "mr:0104-titus", action: "rename", new_subject_la: "Sanctus Titus", class: "A-genitive", confidence: "high", incipit: "In Creta natalis sancti Titi", reasoning: "person" },
  { old_id: "mr:1225-quodsequitur-legitur-in", new_id: "", action: "delete", class: "G-rubric", confidence: "high", incipit: "Quod sequitur" },
  { old_id: "mr:0108-severinus-neapoli", new_id: "mr:0108-severinus", action: "delete", class: "M-merge", confidence: "low", incipit: "Neapoli, in Campania" },
];

describe("changeset", () => {
  it("converts a CRMEDR manifest to crmedr-changeset/v1", () => {
    const cs = convertManifest(manifest, { edition: "martyrologium_romanum_1749", registry: "crmedr@test" });
    expect(cs.schema).toBe("crmedr-changeset/v1");
    expect(cs.operations[0]).toMatchObject({ op: "rename", id: "mr:0104-titi", new_id: "mr:0104-titus", subject_la: "Sanctus Titus", decision: null });
    expect(cs.operations[1]).toMatchObject({ op: "delete", id: "mr:1225-quodsequitur-legitur-in", reason: "rubric" });
    expect(cs.operations[2]).toMatchObject({ op: "merge", ids: ["mr:0108-severinus-neapoli"], winner: "mr:0108-severinus" });
  });

  it("parseChangeset rejects wrong schema", () => {
    expect(() => parseChangeset(JSON.stringify({ schema: "nope", operations: [] }))).toThrow();
  });

  it("exportChangeset merges decisions and edits", () => {
    const cs = convertManifest(manifest, { edition: "e", registry: "r" });
    const out = exportChangeset(cs, { [opId(cs.operations[0])]: { decision: "edit", edited: { new_id: "mr:0104-titus-x" } }, [opId(cs.operations[1])]: { decision: "accept" } });
    expect(out.generated_by).toBe("curation-ui");
    expect(out.operations[0]).toMatchObject({ decision: "edit", edited: { new_id: "mr:0104-titus-x" } });
    expect(out.operations[1].decision).toBe("accept");
    expect(out.operations[2].decision).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- changeset`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `lib/changeset.ts` and `scripts/import-changeset.mjs`**

`lib/changeset.ts`:
```ts
export type Decision = null | "accept" | "reject" | "edit";
export interface DecisionRecord { decision: Exclude<Decision, null>; edited?: { new_id?: string; subject_la?: string }; }
interface Base { class?: string; confidence?: string; incipit?: string; reasoning?: string; decision: Decision; edited?: { new_id?: string; subject_la?: string } | null; }
export interface RenameOp extends Base { op: "rename"; id: string; new_id: string; subject_la?: string; }
export interface DeleteOp extends Base { op: "delete"; id: string; reason?: string; }
export interface MergeOp extends Base { op: "merge"; ids: string[]; winner: string; }
export interface UnknownOp extends Base { op: string; id?: string; [k: string]: unknown; }
export type Op = RenameOp | DeleteOp | MergeOp | UnknownOp;
export interface Changeset { schema: "crmedr-changeset/v1"; generated_by: string; generated_at?: string; base: { edition: string; registry: string }; operations: Op[]; }

export function parseChangeset(text: string): Changeset {
  const cs = JSON.parse(text);
  if (cs?.schema !== "crmedr-changeset/v1") throw new Error(`Unsupported change-set schema: ${cs?.schema}`);
  if (!Array.isArray(cs.operations)) throw new Error("change-set has no operations[]");
  return cs as Changeset;
}
export function isAdjudicable(op: Op): boolean { return op.op === "rename" || op.op === "delete" || op.op === "merge"; }
export function opId(op: Op): string {
  if (op.op === "merge") return (op as MergeOp).ids.join("+");
  return (op as { id?: string }).id ?? JSON.stringify(op);
}
export function exportChangeset(cs: Changeset, decisions: Record<string, DecisionRecord>): Changeset {
  return {
    ...cs, generated_by: "curation-ui",
    operations: cs.operations.map((op) => {
      const d = decisions[opId(op)];
      return d ? { ...op, decision: d.decision, edited: d.edited ?? null } : { ...op, decision: op.decision ?? null };
    }),
  };
}
```

`scripts/import-changeset.mjs`:
```js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

export function convertManifest(manifest, base) {
  const operations = manifest.map((r) => {
    const common = { class: r.class ?? null, confidence: r.confidence ?? null, incipit: r.incipit ?? "", reasoning: r.reasoning ?? "", decision: null, edited: null };
    if (r.action === "rename") return { op: "rename", id: r.old_id, new_id: r.new_id, subject_la: r.new_subject_la ?? "", ...common };
    if (r.action === "delete" && r.class === "M-merge") return { op: "merge", ids: [r.old_id], winner: r.new_id, ...common };
    if (r.action === "delete") return { op: "delete", id: r.old_id, reason: (r.class === "G-rubric" ? "rubric" : (r.class ?? "delete")), ...common };
    return { op: "unknown", id: r.old_id, ...common };
  });
  return { schema: "crmedr-changeset/v1", generated_by: "claude-code", base, operations };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = process.argv[2] ?? join(here, "..", "..", "crmedr", "data", "deprecated_id_corrections.json");
  const name = process.argv[3] ?? "deprecated-id-normalization";
  const edition = process.argv[4] ?? "martyrologium_romanum_1749";
  const manifest = JSON.parse(readFileSync(src, "utf8"));
  const cs = convertManifest(manifest, { edition, registry: "crmedr@local" });
  const dest = join(here, "..", "data", "changesets", `${name}.json`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(cs, null, 1) + "\n");
  console.log(`wrote ${dest}: ${cs.operations.length} operations (${basename(src)})`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run tests + generate the real change-set**

Run: `npm test -- changeset && npm run import-changeset`
Expected: tests pass; writes `data/changesets/deprecated-id-normalization.json` (~487 operations). Commit the generated change-set (bundled input).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: crmedr-changeset/v1 schema, converter, loader"
```

---

## Task 5: Compare view

**Files:** Create `lib/compare.ts`, `lib/__tests__/compare.test.ts`, `components/CompareControls.tsx`, `components/CompareDay.tsx`, replace `app/compare/page.tsx`.

**Interfaces:**
- Consumes: `getEditions`, `getCatalog` (Task 2), `getSnapshot`/`SnapshotEntry` (Task 3).
- Produces:
  - `lib/compare.ts`: `interface CompareRow { id: string; status: "both"|"a-only"|"b-only"; color: "red"|"green"|"none"; crossDay: boolean; subject: string|null; country: string|null; anchorDay: string; }` ; `interface CompareDayGroup { day: string; rows: CompareRow[]; counts: { both:number; aOnly:number; bOnly:number; red:number; green:number } }` ; `function buildComparison(a: CatalogEntryOut[], b: CatalogEntryOut[], snapshot: RegistrySnapshot): CompareDayGroup[]`.
  - Logic: consider only entries with `present !== false`; index each side by `id`; a physical day is a `day_printed`. For each id in A∪B: it belongs to A's `day_printed` and/or B's. `status` = both if the id is present on the SAME `day_printed` in both; else `a-only` (on A's day) and separately `b-only` (on B's day). `color`: for a/b-only rows, `red` if `snapshot[id]?.deprecated` (fallback to the catalog `deprecated`), else `green`; `none` for both. `crossDay` = `anchor_day !== day_printed`. Group rows under each `day` (sorted "MM-DD"), sorted within a day by `entry ?? Infinity` then id.

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/compare.test.ts
import { describe, it, expect } from "vitest";
import { buildComparison } from "@/lib/compare";
import type { CatalogEntryOut } from "@/lib/types";
import type { RegistrySnapshot } from "@/lib/snapshot";

const mk = (id: string, day: string, dep = false, entry = 1, anchor = day): CatalogEntryOut =>
  ({ id, subject: id, anchor_day: anchor, deprecated: dep, present: true, day_printed: day, entry });
const snap: RegistrySnapshot = {} as RegistrySnapshot;

describe("buildComparison", () => {
  it("aligns by id within a physical day; flags a-only/b-only with color", () => {
    const a = [mk("mr:0101-x", "01-01"), mk("mr:0101-dep", "01-01", true)];
    const b = [mk("mr:0101-x", "01-01")];
    const groups = buildComparison(a, b, snap);
    const d = groups.find((g) => g.day === "01-01")!;
    expect(d.rows.find((r) => r.id === "mr:0101-x")!.status).toBe("both");
    const dep = d.rows.find((r) => r.id === "mr:0101-dep")!;
    expect(dep.status).toBe("a-only");
    expect(dep.color).toBe("red"); // deprecated -> red
    expect(d.counts.aOnly).toBe(1);
  });

  it("marks cross-day when anchor_day != day_printed", () => {
    const a = [mk("mr:1229-y", "01-02", false, 2, "12-29")];
    const groups = buildComparison(a, [], snap);
    expect(groups[0].day).toBe("01-02");
    expect(groups[0].rows[0].crossDay).toBe(true);
  });

  it("non-deprecated a-only is green", () => {
    const groups = buildComparison([mk("mr:0101-new", "01-01")], [], snap);
    expect(groups[0].rows[0].color).toBe("green");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- compare`
Expected: FAIL — `@/lib/compare` missing.

- [ ] **Step 3: Implement `lib/compare.ts`**

```ts
import type { CatalogEntryOut } from "@/lib/types";
import type { RegistrySnapshot } from "@/lib/snapshot";

export interface CompareRow { id: string; status: "both" | "a-only" | "b-only"; color: "red" | "green" | "none"; crossDay: boolean; subject: string | null; country: string | null; anchorDay: string; entry: number | null; }
export interface CompareDayGroup { day: string; rows: CompareRow[]; counts: { both: number; aOnly: number; bOnly: number; red: number; green: number }; }

export function buildComparison(a: CatalogEntryOut[], b: CatalogEntryOut[], snapshot: RegistrySnapshot): CompareDayGroup[] {
  const present = (xs: CatalogEntryOut[]) => xs.filter((e) => e.present !== false && e.day_printed);
  const byId = (xs: CatalogEntryOut[]) => new Map(xs.map((e) => [e.id, e]));
  const A = byId(present(a)), B = byId(present(b));
  const days = new Map<string, CompareRow[]>();
  const push = (day: string, row: CompareRow) => { if (!days.has(day)) days.set(day, []); days.get(day)!.push(row); };
  const color = (id: string, e: CatalogEntryOut): "red" | "green" => ((snapshot[id]?.deprecated ?? e.deprecated) ? "red" : "green");
  const row = (e: CatalogEntryOut, status: CompareRow["status"], col: CompareRow["color"]): CompareRow => ({
    id: e.id, status, color: col, crossDay: e.anchor_day !== e.day_printed,
    subject: e.subject ?? snapshot[e.id]?.subject.la ?? null, country: snapshot[e.id]?.country ?? null,
    anchorDay: e.anchor_day, entry: e.entry ?? null,
  });
  const ids = new Set([...A.keys(), ...B.keys()]);
  for (const id of ids) {
    const ea = A.get(id), eb = B.get(id);
    if (ea && eb && ea.day_printed === eb.day_printed) push(ea.day_printed!, row(ea, "both", "none"));
    else {
      if (ea) push(ea.day_printed!, row(ea, "a-only", color(id, ea)));
      if (eb) push(eb.day_printed!, row(eb, "b-only", color(id, eb)));
    }
  }
  return [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([day, rows]) => {
    rows.sort((r1, r2) => (r1.entry ?? Infinity) - (r2.entry ?? Infinity) || r1.id.localeCompare(r2.id));
    const counts = { both: 0, aOnly: 0, bOnly: 0, red: 0, green: 0 };
    for (const r of rows) { if (r.status === "both") counts.both++; else if (r.status === "a-only") counts.aOnly++; else counts.bOnly++; if (r.color === "red") counts.red++; if (r.color === "green") counts.green++; }
    return { day, rows, counts };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- compare`
Expected: PASS (3 tests).

- [ ] **Step 5: Build the Compare page + components**

`app/compare/page.tsx` (client component): fetch editions on mount (`getEditions`); two `<select>` for A/B (default to the two public-domain editions if present); on selection fetch both catalogs (`getCatalog(edition, locale)` — locale from the edition's `locale` field, fallback `la`); compute `buildComparison(a, b, getSnapshot())`; render a month filter and, per `CompareDayGroup`, a `<CompareDay>` with its counts and rows. Row coloring: `color==="red"` → `bg-red-100 dark:bg-red-950/40`, `green` → `bg-green-100 dark:bg-green-950/40`, `none` → none; `crossDay` → an amber "cross-day" badge showing `anchorDay`. Clicking a row calls `getElogium(id)` and expands the text inline. Handle loading and `ApiError` (render a clear banner: "API unreachable — is martyrology-api running on API_BASE?"). Keep components small: `components/CompareControls.tsx` (edition selectors + month nav) and `components/CompareDay.tsx` (a day's table).

Provide a component render test `components/__tests__/CompareDay.test.tsx` that renders a `CompareDayGroup` fixture and asserts a red row has the red class and a cross-day badge appears. Mock `@/lib/api` where needed.

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pass; no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Compare view — physical-day alignment with red/green deprecated diff"
```

---

## Task 6: Review view

**Files:** Create `lib/decisions.ts`, `lib/__tests__/decisions.test.ts`, `components/OperationCard.tsx`, `components/ReviewSummary.tsx`, replace `app/review/page.tsx`, add `components/__tests__/OperationCard.test.tsx`.

**Interfaces:**
- Consumes: `parseChangeset`, `exportChangeset`, `opId`, `isAdjudicable`, types (Task 4); `getElogium` (Task 2); `getSnapshot` (Task 3).
- Produces:
  - `lib/decisions.ts`: `type DecisionMap = Record<string, DecisionRecord>`; `function decisionsKey(cs: Changeset): string` (stable key from `base` + op count); `loadDecisions(key)`, `saveDecisions(key, map)` (localStorage, SSR-safe no-ops when `window` is undefined); `summarize(cs, map): { accepted:number; rejected:number; edited:number; undecided:number }`.
  - `components/OperationCard.tsx`: renders one `Op` — fetches `getElogium(op affected id)` for the live Latin/English text, shows proposal + metadata, Accept/Reject/Edit controls that call an `onDecide(opId, DecisionRecord)` prop.
  - `app/review/page.tsx`: change-set source selector (bundled list from `data/changesets/` via a generated manifest OR file upload), renders `OperationCard`s with filters, a `ReviewSummary`, and an Export button (`exportChangeset` → download).

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/decisions.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { summarize, saveDecisions, loadDecisions, decisionsKey } from "@/lib/decisions";
import type { Changeset } from "@/lib/changeset";

const cs: Changeset = { schema: "crmedr-changeset/v1", generated_by: "x", base: { edition: "e", registry: "r" },
  operations: [ { op: "rename", id: "a", new_id: "a2", decision: null }, { op: "delete", id: "b", decision: null }, { op: "merge", ids: ["c"], winner: "c2", decision: null } ] as never };

describe("decisions", () => {
  beforeEach(() => localStorage.clear());
  it("summarizes decided vs undecided", () => {
    const s = summarize(cs, { a: { decision: "accept" }, b: { decision: "reject" } });
    expect(s).toEqual({ accepted: 1, rejected: 1, edited: 0, undecided: 1 });
  });
  it("persists and reloads by key", () => {
    const key = decisionsKey(cs);
    saveDecisions(key, { a: { decision: "edit", edited: { new_id: "z" } } });
    expect(loadDecisions(key)).toEqual({ a: { decision: "edit", edited: { new_id: "z" } } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- decisions`
Expected: FAIL — `@/lib/decisions` missing.

- [ ] **Step 3: Implement `lib/decisions.ts`**

```ts
import type { Changeset, DecisionRecord } from "@/lib/changeset";
import { opId } from "@/lib/changeset";
export type DecisionMap = Record<string, DecisionRecord>;
export function decisionsKey(cs: Changeset): string { return `mrf:decisions:${cs.base.edition}:${cs.base.registry}:${cs.operations.length}`; }
export function loadDecisions(key: string): DecisionMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(key) ?? "{}"); } catch { return {}; }
}
export function saveDecisions(key: string, map: DecisionMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(map));
}
export function summarize(cs: Changeset, map: DecisionMap) {
  let accepted = 0, rejected = 0, edited = 0, undecided = 0;
  for (const op of cs.operations) {
    const d = map[opId(op)]?.decision;
    if (d === "accept") accepted++; else if (d === "reject") rejected++; else if (d === "edit") edited++; else undecided++;
  }
  return { accepted, rejected, edited, undecided };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- decisions`
Expected: PASS.

- [ ] **Step 5: Build the Review page + components**

- `components/OperationCard.tsx` (client): props `{ op: Op; decision?: DecisionRecord; onDecide: (id: string, d: DecisionRecord) => void; locale: "la"|"it"|"en" }`. On mount, if the op has an affected id (`rename`/`delete` → `op.id`; `merge` → `op.ids[0]`), call `getElogium(id, locale)` and show the edition's text (`eulogy.editions[?].text`, or any available) plus `subject`. Render the proposal (`rename` old→`new_id`; `delete` + reason; `merge` ids→winner), `class`/`confidence`/`reasoning`. Buttons: **Accept** (`onDecide(opId, {decision:"accept"})`), **Reject** (`{decision:"reject"}`), **Edit** (reveals inputs for `new_id`/`subject_la`, saving `{decision:"edit", edited:{...}}`). Show the current decision state (highlight). Non-adjudicable ops render read-only with a note. Handle `ApiError` per card (show "text unavailable" without breaking the card).
- `components/ReviewSummary.tsx`: shows `summarize(...)` counts + total, and the Export button.
- `app/review/page.tsx` (client): source picker — (a) bundled change-sets: read a generated `data/changesets/index.json` (list of filenames; add its generation to `scripts/import-changeset.mjs` or a one-line `changesets/index.json`), fetch the chosen one via a static import or `fetch("/changesets/...")` after copying `data/changesets` into `public/changesets` (add a `prebuild`/`predev` copy step, or place change-sets directly under `public/changesets/`); (b) file upload (`<input type=file>` → `parseChangeset(text)`). Maintain `DecisionMap` state seeded from `loadDecisions(decisionsKey(cs))`; on each `onDecide`, update state + `saveDecisions`. Filters: by `class`, `confidence`, `op`, and "undecided only". Export: `exportChangeset(cs, decisions)` → `Blob` download named `<name>.decided.json`.

  Decision on static serving: **place bundled change-sets under `public/changesets/` and the snapshot import under `public` as needed** so the client can `fetch("/changesets/<name>.json")`; update `scripts/import-changeset.mjs` dest to `public/changesets/` and `scripts/snapshot-registry.mjs` to keep `data/registry-snapshot.json` (imported at build, not fetched). Adjust Task 3/4 dest paths accordingly during this task and re-run both scripts.

- Add `components/__tests__/OperationCard.test.tsx`: mock `@/lib/api` `getElogium` to resolve a fixture eulogy; render a `rename` op; assert the Latin text and old→new appear; click Accept and assert `onDecide` called with `{decision:"accept"}`.

- [ ] **Step 6: Run tests + typecheck + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass; production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Review view — adjudicate change-set ops against live eulogy text, export decisions"
```

---

## Task 7: Integration, README, live-API verification

**Files:** Create `README.md`; add error/empty states already covered; verify end-to-end against a running API.

- [ ] **Step 1: Write `README.md`**

Document: purpose; prerequisites (Node 20+, a running `martyrology-api`); setup (`npm install`, `cp .env.example .env`); the two data scripts (`npm run snapshot-registry`, `npm run import-changeset`) and that they read `../crmedr`; running (`npm run dev`, open `/compare` and `/review`); the change-set format pointer to the spec; and the note that eulogy text requires the API and the private 2004 edition returns 404 in a public clone.

- [ ] **Step 2: Live end-to-end verification** (manual, with the API running)

```bash
# in ../martyrology-api:  uvicorn martyrology_api.app:create_app --factory --reload   (serves public-domain editions)
# in martyrology-frontend:
npm run snapshot-registry && npm run import-changeset && npm run dev
```
Verify in the browser:
1. `/compare` lists editions; selecting `martyrologium_romanum_1749` (A) and `martyrologium_romanum_1914_en_unofficial` (B) renders days with aligned rows; deprecated-only rows are RED, non-deprecated-only GREEN; a known cross-day entry (e.g. `mr:1229-martinianus` under a January day) shows the cross-day badge.
2. `/review` loads `deprecated-id-normalization`; an op (e.g. `mr:0104-titi → mr:0104-titus`) shows the real 1749 Latin text; Accept/Reject/Edit work; the summary updates; reloading the page preserves decisions; Export downloads a `crmedr-changeset/v1` file with decisions set.
3. Stop the API and confirm `/compare` shows the clear "API unreachable" banner rather than a blank/crash.

Record the outcomes (screenshots or notes) in the PR/commit description.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: README + verified end-to-end against local martyrology-api"
```

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`.

---

## Self-Review

- **Spec coverage:** scaffold (T1); API proxy/client + types (T2); bundled snapshot with country + multilingual subjects (T3); change-set schema + converter + loader (T4); Compare view organized by physical day, aligned by ID, RED/GREEN by deprecated, cross-day surfaced (T5); Review view with live eulogy text, Accept/Reject/Edit, resumable persistence, export (T6); README + live verification + graceful API-down state (T7). Phase-B ops are schema-reserved and render read-only (T4/T6). All spec sections covered.
- **Placeholder scan:** none — every code step carries runnable code. The one deferred decision (serve bundled change-sets from `public/changesets/` vs `data/`) is resolved explicitly in T6 Step 5 with the exact path change and a note to adjust T3/T4 dests.
- **Type consistency:** `Changeset`/`Op`/`DecisionRecord`/`opId`/`exportChangeset` are defined in T4 and consumed unchanged in T6; `CatalogEntryOut`/`EulogyOut` from T2 flow into T5/T6; `RegistrySnapshot`/`SnapshotEntry` from T3 into T5. `buildComparison` signature in T5 matches its test and page usage.
- **Note:** T5/T6 UI depends on a running `martyrology-api`; unit tests mock the client, and T7 covers live verification. Exact Next.js 16 / Tailwind v4 dependency versions should be confirmed against `cdcf-website` at scaffold time (T1) and pinned to whatever it uses.
