# Reader and Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-link landing page with a public bookshelf of Martyrology editions that opens into a single-page-per-day reader. Restrict `/review` to curators. Add a per-caller access endpoint to martyrology-api.

**Architecture:**
- **API:** martyrology-api gains `GET /api/v1/access`, which tells the caller which editions it may read.
- **Frontend libraries:** pure modules (`lib/calendar.ts`, `lib/editions.ts`, `lib/roles.ts`) hold the date and edition logic, kept separate from the UI.
- **Frontend pages:** server components read the viewer (signed in? curator?) and validate the route. Client components fetch through the existing `/api/mr` proxy, which forwards and refreshes the session token.
- **Curator flag:** derived from Zitadel's roles claim at sign-in and stored as a boolean on the JWT and the Session.

**Tech Stack:**
- martyrology-api: FastAPI, Pydantic, pytest, ruff, pyright.
- martyrology-frontend: Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, CSS Modules, Auth.js v5 (`next-auth` 5.0.0-beta.32), Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-reader-and-landing-design.md` (this repo).

## Global Constraints

- The access token never reaches the Session. The Session may carry only `user`, `expires`, `error` and `curator` (a boolean). `lib/__tests__/auth-callbacks.test.ts` guards this.
- Anonymous requests to the API stay identical: the `/api/mr` proxy is not modified.
- `/editions` stays shared-cacheable and unchanged. `/access` is `Cache-Control: private`.
- Curators are users holding the Zitadel project role `admin` or `martyrology_editor`. Everyone else gets no Review link, and `/review` returns 404.
- Shelf order: newest year first; within a year, `editio_typica*` first, then `editio_vernacula`, then `translatio`.
- Cover titles by language: `la` → "MARTYROLOGIUM ROMANUM", `it*` → "MARTIROLOGIO ROMANO", `en` → "ROMAN MARTYROLOGY". Language labels: "Latin", "Italiano (CEI)", "English".
- Book states:
  - `unavailable` when `availability.status === "unavailable"`;
  - otherwise `open` when `/access` says `can_read_texts: true`;
  - otherwise `locked`.
  - If `/access` fails, every non-unavailable book is `open`.
- Calendar:
  - February always has 29 days;
  - 31 December turns to 1 January, and 1 January back to 31 December;
  - "today" is the browser's local date.
- Motion: with `prefers-reduced-motion: reduce`, there is no tilt, cover swing or page-turn animation.
- In the frontend, every commit is GPG-signed (`git commit -S`), and every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Next.js 16: page `params` is a `Promise` and must be awaited. Consult `node_modules/next/dist/docs/` when unsure (see `AGENTS.md`).

## Review Focus

1. **A locked edition opened by URL**, for example a shared link to a 2004 day opened while signed out. The reader must show the locked message, never a page of blank eulogies. Task 9 has a test.
2. **The 1914 English edition outside January and February**, where the API returns 404. The reader must say "This edition has no text for 2 October" and keep its controls working. Task 9 has a test.
3. **`/access` failing while `/editions` succeeds.** The shelf must still render, with every non-unavailable book shown as open. Task 7 has a test.
4. **A curator's role claim missing or malformed** (absent, a string, an array). This must count as not a curator and must not throw during sign-in. Task 4 has a test.
5. **Arrow keys pressed while a picker has focus.** They must change the picker, not turn the page. Task 9 has a test.

---

## File structure

**martyrology-api** (Task 1)
- `src/martyrology_api/models.py`: modify. Add `EditionAccessOut` and `AccessOut`.
- `src/martyrology_api/routers/discovery.py`: modify. Add `GET /access`.
- `tests/test_access_api.py`: create.

**martyrology-frontend**
- `lib/calendar.ts`: create (Task 2). Days, wrap-around, URL parts, month names, date headings.
- `lib/editions.ts`: create (Task 3). Titles, labels, shelf order, shelf state.
- `lib/types.ts`, `lib/api.ts`: modify (Task 3). `AccessOut`, `DayOut`, `getAccess()`; `getDay()` returns `DayOut`.
- `lib/roles.ts`: create (Task 4). `isCurator()`.
- `auth.ts`, `types/next-auth.d.ts`: modify (Task 4). The `curator` flag.
- `lib/viewer.ts`: create (Task 4). `getViewer()`, a server-only read of the session.
- `components/ReviewPage.tsx`: create (Task 5), with the current review UI moved here.
- `app/review/page.tsx`: replace (Task 5) with the curator gate.
- `components/SiteHeader.tsx`, `app/layout.tsx`: modify (Task 5). Navigation and title.
- `components/book.module.css`, `components/BookCover.tsx`: create (Task 6).
- `components/LockedNotice.tsx`, `components/Bookshelf.tsx`: create (Task 7). `app/page.tsx`: replace (Task 7).
- `components/page.module.css`, `components/DayPage.tsx`: create (Task 8).
- `components/ReaderBar.tsx`, `components/Reader.tsx`, `components/TodayRedirect.tsx`, `lib/server-editions.ts`, `app/read/[edition]/page.tsx`, `app/read/[edition]/[mm]/[dd]/page.tsx`: create (Task 9).
- `README.md`: modify (Task 10).

Tests sit next to the existing ones: `lib/__tests__/` and `components/__tests__/`.

---

### Task 1: `GET /api/v1/access` in martyrology-api

**Files:**
- Modify: `/home/johnrdorazio/development/CatholicOS_org/martyrology-api/src/martyrology_api/models.py` (after `EditionsOut`, around line 110)
- Modify: `/home/johnrdorazio/development/CatholicOS_org/martyrology-api/src/martyrology_api/routers/discovery.py`
- Test: `/home/johnrdorazio/development/CatholicOS_org/martyrology-api/tests/test_access_api.py`

**Interfaces:**
- Produces: `GET /api/v1/access` → `{"editions": {"<edition_id>": {"can_read_texts": bool}}}`, covering every edition in the registry; `Cache-Control: private, max-age=0`; 401 for an invalid bearer token. Task 3 consumes it as `AccessOut`.

All work happens in `/home/johnrdorazio/development/CatholicOS_org/martyrology-api`, on a new branch: `git switch -c feat/access-endpoint origin/main`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_access_api.py`:

```python
import pytest

from martyrology_api.auth import Identity


class StaticAuth:
    async def identity(self, token):
        return Identity(subject="u123", username="jdoe") if token == "good" else None


class GrantReaders:
    def __init__(self, allowed_editions):
        self.allowed = allowed_editions

    async def check(self, user, relation, edition_id):
        return relation == "can_read_texts" and edition_id in self.allowed


@pytest.fixture
def client(make_client):
    c = make_client()
    c.app.state.authenticator = StaticAuth()
    c.app.state.authz = GrantReaders({"martyrologium_romanum_2004"})
    return c


def test_anonymous_can_read_only_unrestricted_editions(client):
    r = client.get("/api/v1/access")
    assert r.status_code == 200
    editions = r.json()["editions"]
    assert editions["martyrologium_romanum_1749"] == {"can_read_texts": True}
    # Not restricted, so readable — the shelf separately shows it as unavailable.
    assert editions["martyrologium_romanum_1584"] == {"can_read_texts": True}
    assert editions["martyrologium_romanum_2004"] == {"can_read_texts": False}
    assert editions["martyrologium_romanum_2004_it_IT"] == {"can_read_texts": False}


def test_covers_every_registered_edition(client):
    ids = {e["edition_id"] for e in client.get("/api/v1/editions").json()["editions"]}
    assert set(client.get("/api/v1/access").json()["editions"]) == ids


def test_authorized_caller_gets_granted_edition_only(client):
    editions = client.get(
        "/api/v1/access", headers={"Authorization": "Bearer good"}
    ).json()["editions"]
    assert editions["martyrologium_romanum_2004"] == {"can_read_texts": True}
    assert editions["martyrologium_romanum_2004_it_IT"] == {"can_read_texts": False}


def test_response_is_private(client):
    r = client.get("/api/v1/access")
    assert r.headers["cache-control"] == "private, max-age=0"


def test_bad_token_is_401(client):
    r = client.get("/api/v1/access", headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/pytest tests/test_access_api.py -q`
Expected: FAIL. The route doesn't exist, so the status is 404 rather than 200.

- [ ] **Step 3: Add the models**

In `src/martyrology_api/models.py`, directly after `class EditionsOut`:

```python
class EditionAccessOut(BaseModel):
    can_read_texts: bool


class AccessOut(BaseModel):
    editions: dict[str, EditionAccessOut]
```

- [ ] **Step 4: Add the route**

In `src/martyrology_api/routers/discovery.py`:
- add the imports `from ..auth import Identity, get_identity` and `from ..licensing import texts_allowed`;
- add `AccessOut` and `EditionAccessOut` to the `..models` import list;
- then add, after `get_editions`:

```python
@router.get("/access")
async def get_access(
    request: Request, identity: Identity | None = Depends(get_identity)
) -> AccessOut:
    """Which editions' texts the caller may read. The answer depends on the
    caller, so it is never shared-cacheable: cache_private overrides this
    router's public default."""
    request.state.cache_private = True
    registry = request.app.state.registry
    return AccessOut(
        editions={
            edition_id: EditionAccessOut(
                can_read_texts=await texts_allowed(request, identity, edition_id)
            )
            for edition_id in sorted(registry.editions)
        }
    )
```

- [ ] **Step 5: Run the tests and the repo's checks**

Run: `.venv/bin/pytest -q && .venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright`
Expected: everything passes, including the 5 new tests and `test_openapi.py`.

- [ ] **Step 6: Commit and push, then open a PR**

```bash
git add src/martyrology_api/models.py src/martyrology_api/routers/discovery.py tests/test_access_api.py
git commit -S -m "feat: GET /access reports which editions the caller may read

The frontend's bookshelf needs to know, per edition, whether the caller can
open its texts without fetching any. Reuses texts_allowed (public editions
always; restricted ones through OpenFGA can_read_texts). Private-cached,
since the answer depends on the caller.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/access-endpoint
gh pr create --base main --title "feat: GET /access reports which editions the caller may read" --body "Adds GET /api/v1/access for the martyrology-frontend bookshelf (spec: martyrology-frontend docs/superpowers/specs/2026-10-02-reader-and-landing-design.md §4). Private-cached; 401 on a bad token like the read routes."
```

---

### Task 2: `lib/calendar.ts`

**Files:**
- Create: `lib/calendar.ts`
- Test: `lib/__tests__/calendar.test.ts`

**Interfaces:**
- Produces:
  - `type Day = { mm: number; dd: number }` (1-based)
  - `daysInMonth(mm: number): number`
  - `parseDay(mm: string, dd: string): Day | null`
  - `nextDay(d: Day): Day`, `prevDay(d: Day): Day`
  - `todayLocal(now?: Date): Day`
  - `pad2(n: number): string`
  - `dayPath(edition: string, d: Day): string`
  - `type Lang = "la" | "it" | "en"`
  - `monthName(mm: number, lang: Lang): string`
  - `dateHeading(d: Day, lang: Lang): string`

Frontend work happens in `/home/johnrdorazio/development/CatholicOS_org/martyrology-frontend`, on the branch `feat/reader-and-landing`. Create it in this task: `git switch -c feat/reader-and-landing origin/main`, then `git checkout docs/reader-and-landing-spec -- docs/superpowers/specs/2026-10-02-reader-and-landing-design.md docs/superpowers/plans/2026-10-02-reader-and-landing.md .gitignore`, and commit those in this task's commit.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/calendar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  daysInMonth, parseDay, nextDay, prevDay, todayLocal, pad2, dayPath, monthName, dateHeading,
} from "@/lib/calendar";

describe("calendar", () => {
  it("gives February 29 days and the other months their usual lengths", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(daysInMonth))
      .toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("parses two-digit URL parts and rejects anything else", () => {
    expect(parseDay("02", "29")).toEqual({ mm: 2, dd: 29 });
    expect(parseDay("10", "02")).toEqual({ mm: 10, dd: 2 });
    for (const [mm, dd] of [["2", "02"], ["13", "01"], ["00", "10"], ["04", "31"], ["02", "30"], ["ab", "01"], ["01", "00"]]) {
      expect(parseDay(mm, dd)).toBeNull();
    }
  });

  it("turns the page across months and wraps the year both ways", () => {
    expect(nextDay({ mm: 1, dd: 31 })).toEqual({ mm: 2, dd: 1 });
    expect(nextDay({ mm: 2, dd: 28 })).toEqual({ mm: 2, dd: 29 });
    expect(nextDay({ mm: 2, dd: 29 })).toEqual({ mm: 3, dd: 1 });
    expect(nextDay({ mm: 12, dd: 31 })).toEqual({ mm: 1, dd: 1 });
    expect(prevDay({ mm: 3, dd: 1 })).toEqual({ mm: 2, dd: 29 });
    expect(prevDay({ mm: 1, dd: 1 })).toEqual({ mm: 12, dd: 31 });
  });

  it("reads today from the local date", () => {
    expect(todayLocal(new Date(2026, 9, 2, 23, 59))).toEqual({ mm: 10, dd: 2 });
  });

  it("builds reader paths with zero-padded parts", () => {
    expect(pad2(3)).toBe("03");
    expect(dayPath("martyrologium_romanum_1749", { mm: 1, dd: 2 }))
      .toBe("/read/martyrologium_romanum_1749/01/02");
  });

  it("names months and writes date headings in the edition's language", () => {
    expect(monthName(10, "en")).toBe("October");
    expect(dateHeading({ mm: 1, dd: 2 }, "la")).toBe("2 Ianuarii");
    expect(dateHeading({ mm: 10, dd: 2 }, "it")).toBe("2 ottobre");
    expect(dateHeading({ mm: 12, dd: 25 }, "en")).toBe("25 December");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/__tests__/calendar.test.ts`
Expected: FAIL, because `@/lib/calendar` cannot be resolved.

- [ ] **Step 3: Implement**

Create `lib/calendar.ts`:

```ts
// The Martyrology's calendar: every year has a 29 February page, and the book
// turns over from 31 December to 1 January. Months and days are 1-based.

export type Day = { mm: number; dd: number };
export type Lang = "la" | "it" | "en";

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MONTHS: Record<Lang, string[]> = {
  // Genitive, as printed in day headings ("2 Ianuarii").
  la: ["Ianuarii", "Februarii", "Martii", "Aprilis", "Maii", "Iunii",
       "Iulii", "Augusti", "Septembris", "Octobris", "Novembris", "Decembris"],
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
       "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
};

export function daysInMonth(mm: number): number {
  return MONTH_DAYS[mm - 1];
}

/** The reader's URL parts, which must be exactly two digits each and a real page. */
export function parseDay(mm: string, dd: string): Day | null {
  if (!/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) return null;
  const m = Number(mm);
  const d = Number(dd);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(m)) return null;
  return { mm: m, dd: d };
}

export function nextDay({ mm, dd }: Day): Day {
  if (dd < daysInMonth(mm)) return { mm, dd: dd + 1 };
  return mm === 12 ? { mm: 1, dd: 1 } : { mm: mm + 1, dd: 1 };
}

export function prevDay({ mm, dd }: Day): Day {
  if (dd > 1) return { mm, dd: dd - 1 };
  return mm === 1 ? { mm: 12, dd: 31 } : { mm: mm - 1, dd: daysInMonth(mm - 1) };
}

export function todayLocal(now: Date = new Date()): Day {
  return { mm: now.getMonth() + 1, dd: now.getDate() };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dayPath(edition: string, d: Day): string {
  return `/read/${encodeURIComponent(edition)}/${pad2(d.mm)}/${pad2(d.dd)}`;
}

export function monthName(mm: number, lang: Lang): string {
  return MONTHS[lang][mm - 1];
}

export function dateHeading(d: Day, lang: Lang): string {
  return `${d.dd} ${monthName(d.mm, lang)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/__tests__/calendar.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar.ts lib/__tests__/calendar.test.ts docs/superpowers/specs/2026-10-02-reader-and-landing-design.md docs/superpowers/plans/2026-10-02-reader-and-landing.md .gitignore
git commit -S -m "feat: calendar helpers for the reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/editions.ts`, API types and `getAccess()`

**Files:**
- Create: `lib/editions.ts`
- Modify: `lib/types.ts` (add `AccessMap`, `AccessOut`, `DayOut`)
- Modify: `lib/api.ts` (add `getAccess`; `getDay` returns `DayOut`)
- Test: `lib/__tests__/editions.test.ts`

**Interfaces:**
- Consumes: `Lang` from `lib/calendar.ts` (Task 2); `GET /api/v1/access` (Task 1).
- Produces:
  - `type AccessMap = Record<string, { can_read_texts: boolean }>`
  - `interface DayOut extends DayContentOut { metadata: { edition: string; month: number; day: number | null; access?: string | null; access_info?: string | null } }`
  - `getAccess(): Promise<AccessMap>`
  - `getDay(edition: string, mm: string, dd: string): Promise<DayOut>`
  - `type ShelfState = "open" | "locked" | "unavailable"`
  - `editionLang(e: EditionOut): Lang`
  - `editionTitle(e: EditionOut): string` (upper case, for covers)
  - `languageLabel(e: EditionOut): string`
  - `isOriginal(e: EditionOut): boolean`
  - `sortForShelf(es: EditionOut[]): EditionOut[]`
  - `shelfState(e: EditionOut, access: AccessMap | null): ShelfState`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/editions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { editionLang, editionTitle, languageLabel, isOriginal, sortForShelf, shelfState } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

function ed(edition_id: string, year: number, locale: string, nature: string, status = "public"): EditionOut {
  return {
    edition_id, year, locale, nature, book: "martyrologium", scope: {}, promulgation: {},
    governance: { governing_body: "", type: "" }, availability: { status },
  };
}

const E = {
  e1584: ed("martyrologium_romanum_1584", 1584, "la", "editio_typica", "unavailable"),
  e1749: ed("martyrologium_romanum_1749", 1749, "la", "editio_typica_recognita"),
  e1914: ed("martyrologium_romanum_1914", 1914, "la", "editio_typica_recognita", "unavailable"),
  e1914en: ed("martyrologium_romanum_1914_en_unofficial", 1914, "en", "translatio"),
  e2001: ed("martyrologium_romanum_2001", 2001, "la", "editio_typica", "unavailable"),
  e2004: ed("martyrologium_romanum_2004", 2004, "la", "editio_typica_altera", "restricted-texts"),
  e2004en: ed("martyrologium_romanum_2004_en_unofficial", 2004, "en", "translatio", "restricted-texts"),
  e2004it: ed("martyrologium_romanum_2004_it_IT", 2004, "it-IT", "editio_vernacula", "restricted-texts"),
};

describe("editions", () => {
  it("orders the shelf newest first, originals before vernacular before translations", () => {
    expect(sortForShelf(Object.values(E)).map((e) => e.edition_id)).toEqual([
      "martyrologium_romanum_2004", "martyrologium_romanum_2004_it_IT", "martyrologium_romanum_2004_en_unofficial",
      "martyrologium_romanum_2001", "martyrologium_romanum_1914", "martyrologium_romanum_1914_en_unofficial",
      "martyrologium_romanum_1749", "martyrologium_romanum_1584",
    ]);
  });

  it("titles and labels editions by language", () => {
    expect([editionLang(E.e2004), editionLang(E.e2004it), editionLang(E.e2004en)]).toEqual(["la", "it", "en"]);
    expect(editionTitle(E.e1749)).toBe("MARTYROLOGIUM ROMANUM");
    expect(editionTitle(E.e2004it)).toBe("MARTIROLOGIO ROMANO");
    expect(editionTitle(E.e1914en)).toBe("ROMAN MARTYROLOGY");
    expect([languageLabel(E.e1749), languageLabel(E.e2004it), languageLabel(E.e2004en)])
      .toEqual(["Latin", "Italiano (CEI)", "English"]);
    expect(editionLang(ed("x", 2000, "de", "translatio"))).toBe("la");
  });

  it("tells originals from vernacular editions and translations", () => {
    expect([isOriginal(E.e1749), isOriginal(E.e2004it), isOriginal(E.e1914en)]).toEqual([true, false, false]);
  });

  it("derives each book's state from availability and access", () => {
    const access = { martyrologium_romanum_2004: { can_read_texts: true }, martyrologium_romanum_2004_it_IT: { can_read_texts: false },
      martyrologium_romanum_1749: { can_read_texts: true }, martyrologium_romanum_1584: { can_read_texts: true } };
    expect(shelfState(E.e1584, access)).toBe("unavailable");
    expect(shelfState(E.e1749, access)).toBe("open");
    expect(shelfState(E.e2004, access)).toBe("open");
    expect(shelfState(E.e2004it, access)).toBe("locked");
    expect(shelfState(E.e2004en, access)).toBe("locked"); // absent from the map
  });

  it("opens every available book when access could not be loaded", () => {
    expect(shelfState(E.e2004it, null)).toBe("open");
    expect(shelfState(E.e2001, null)).toBe("unavailable");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/__tests__/editions.test.ts`
Expected: FAIL, because `@/lib/editions` cannot be resolved.

- [ ] **Step 3: Add the types and the API call**

In `lib/types.ts`, after `DayContentOut`:

```ts
export type AccessMap = Record<string, { can_read_texts: boolean }>;

export interface AccessOut {
  editions: AccessMap;
}

/** The day endpoint's full response; `access` is "restricted-texts" when the caller is denied. */
export interface DayOut extends DayContentOut {
  metadata: {
    edition: string;
    month: number;
    day: number | null;
    access?: string | null;
    access_info?: string | null;
  };
}
```

In `lib/api.ts`:
- add `AccessMap`, `AccessOut` and `DayOut` to the `@/lib/types` import;
- change `getDay`'s return type from `Promise<DayContentOut>` to `Promise<DayOut>`, keeping its body;
- remove `DayContentOut` from the import if it's no longer used there;
- then add:

```ts
export async function getAccess(): Promise<AccessMap> {
  return (await get<AccessOut>("access")).editions;
}
```

- [ ] **Step 4: Implement `lib/editions.ts`**

```ts
import type { AccessMap, EditionOut } from "@/lib/types";
import type { Lang } from "@/lib/calendar";

export type ShelfState = "open" | "locked" | "unavailable";

const TITLES: Record<Lang, string> = {
  la: "MARTYROLOGIUM ROMANUM",
  it: "MARTIROLOGIO ROMANO",
  en: "ROMAN MARTYROLOGY",
};

const LABELS: Record<Lang, string> = { la: "Latin", it: "Italiano (CEI)", en: "English" };

export function editionLang(e: EditionOut): Lang {
  if (e.locale.startsWith("it")) return "it";
  if (e.locale.startsWith("en")) return "en";
  return "la";
}

export function editionTitle(e: EditionOut): string {
  return TITLES[editionLang(e)];
}

export function languageLabel(e: EditionOut): string {
  return LABELS[editionLang(e)];
}

function natureRank(e: EditionOut): number {
  if (e.nature.startsWith("editio_typica")) return 0;
  return e.nature === "editio_vernacula" ? 1 : 2;
}

/** A Latin editio typica, as opposed to a vernacular edition or a translation. */
export function isOriginal(e: EditionOut): boolean {
  return natureRank(e) === 0;
}

export function sortForShelf(es: EditionOut[]): EditionOut[] {
  return [...es].sort(
    (a, b) => b.year - a.year || natureRank(a) - natureRank(b) || a.edition_id.localeCompare(b.edition_id),
  );
}

/**
 * `access` is null when /access could not be loaded: every available book is
 * then offered as open, and the reader shows the locked state if the API
 * redacts the texts.
 */
export function shelfState(e: EditionOut, access: AccessMap | null): ShelfState {
  if (e.availability.status === "unavailable") return "unavailable";
  if (access === null) return "open";
  return access[e.edition_id]?.can_read_texts ? "open" : "locked";
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run lib/__tests__/editions.test.ts && npm test && npx tsc --noEmit`
Expected: PASS, 5 new tests, the full suite green and tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/editions.ts lib/__tests__/editions.test.ts lib/types.ts lib/api.ts
git commit -S -m "feat: edition shelf order, titles and access state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The `curator` flag and `getViewer()`

**Files:**
- Create: `lib/roles.ts`, `lib/viewer.ts`
- Modify: `auth.ts` (the `jwt` and `session` callbacks), `types/next-auth.d.ts`
- Test: `lib/__tests__/roles.test.ts`, `lib/__tests__/viewer.test.ts`; modify `lib/__tests__/auth-callbacks.test.ts`

**Interfaces:**
- Produces:
  - `isCurator(rolesClaim: unknown): boolean`
  - `ROLES_CLAIM = "urn:zitadel:iam:org:project:roles"`
  - `Session.curator?: boolean`, `JWT.curator?: boolean`
  - `type Viewer = { signedIn: boolean; curator: boolean }`
  - `getViewer(): Promise<Viewer>` (server-only, memoized per request)

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/roles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isCurator } from "@/lib/roles";

describe("isCurator", () => {
  it("accepts Zitadel's roles object holding admin or martyrology_editor", () => {
    expect(isCurator({ admin: { "1": "martyrology.localhost" } })).toBe(true);
    expect(isCurator({ martyrology_editor: { "1": "x" }, developer: {} })).toBe(true);
  });

  it("rejects other roles and missing or malformed claims", () => {
    for (const claim of [undefined, null, "admin", ["admin"], 42, {}, { developer: {} }]) {
      expect(isCurator(claim)).toBe(false);
    }
  });
});
```

Create `lib/__tests__/viewer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => undefined }));

import { getViewer } from "@/lib/viewer";

describe("getViewer", () => {
  beforeEach(() => authMock.mockReset());

  it("is signed out with no session", async () => {
    authMock.mockResolvedValue(null);
    expect(await getViewer()).toEqual({ signedIn: false, curator: false });
  });

  it("reports a signed-in curator", async () => {
    authMock.mockResolvedValue({ user: { email: "a@b.c" }, curator: true });
    expect(await getViewer()).toEqual({ signedIn: true, curator: true });
  });

  it("falls back to signed out when the session cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    authMock.mockRejectedValue(new Error("bad cookie"));
    expect(await getViewer()).toEqual({ signedIn: false, curator: false });
    expect(warn).toHaveBeenCalled();
  });
});
```

In `lib/__tests__/auth-callbacks.test.ts`:
- in the sign-in mapping test, change the expected object to include `curator: false`;
- add two tests inside `describe("jwt callback", …)`;
- add one inside `describe("session callback", …)`.

```ts
  it("marks a curator from the ID token's project roles at sign-in", async () => {
    const result = await callbacks.jwt({
      token: { sub: "user-1" },
      account: { provider: "zitadel", type: "oidc", providerAccountId: "user-1", access_token: "AT" },
      profile: { "urn:zitadel:iam:org:project:roles": { martyrology_editor: { "1": "x" } } },
    } as never);
    expect(result).toMatchObject({ curator: true });
  });

  it("does not mark a curator when the roles claim is missing or malformed", async () => {
    for (const profile of [{}, { "urn:zitadel:iam:org:project:roles": "admin" }, undefined]) {
      const result = await callbacks.jwt({
        token: { sub: "user-1" },
        account: { provider: "zitadel", type: "oidc", providerAccountId: "user-1", access_token: "AT" },
        profile,
      } as never);
      expect(result).toMatchObject({ curator: false });
    }
  });
```

```ts
  it("exposes curator as a boolean, and never the roles claim", async () => {
    const session = await callbacks.session({
      session: { user: { email: "a@b.c" }, expires: "2099-01-01" },
      token: { ...token, curator: true },
    } as never);
    expect((session as { curator?: unknown }).curator).toBe(true);
    expect(JSON.stringify(session)).not.toContain("urn:zitadel");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/roles.test.ts lib/__tests__/viewer.test.ts lib/__tests__/auth-callbacks.test.ts`
Expected: FAIL. `@/lib/roles` and `@/lib/viewer` cannot be resolved, and the callback tests fail because `curator` is missing.

- [ ] **Step 3: Implement `lib/roles.ts`**

```ts
/** Zitadel's project-roles claim, which it sends without an :aud scope (the app lives in the project). */
export const ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";

const CURATION_ROLES = ["admin", "martyrology_editor"];

/**
 * The claim is an object keyed by role name: {"admin": {"<orgId>": "<domain>"}}.
 * Anything else, including a missing claim, means "not a curator".
 */
export function isCurator(rolesClaim: unknown): boolean {
  if (typeof rolesClaim !== "object" || rolesClaim === null || Array.isArray(rolesClaim)) return false;
  return CURATION_ROLES.some((role) => Object.prototype.hasOwnProperty.call(rolesClaim, role));
}
```

- [ ] **Step 4: Update `auth.ts` and the types**

In `auth.ts`:
- import `import { isCurator, ROLES_CLAIM } from "@/lib/roles";`;
- change the `jwt` callback's signature to `async jwt({ token, account, profile })`;
- change its sign-in branch to:

```ts
    if (account) {
      return {
        ...token,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        // A boolean only: the Session copies it, and the Session is browser-readable.
        // Read once, at sign-in; a newly granted role needs a fresh sign-in.
        curator: isCurator((profile as Record<string, unknown> | undefined)?.[ROLES_CLAIM]),
      };
    }
```

In the `session` callback, after `session.error = current.error;`:

```ts
    // A boolean, never the roles claim itself.
    session.curator = token.curator === true;
```

In `types/next-auth.d.ts`, add `curator?: boolean;` to both `interface Session` and `interface JWT`.

- [ ] **Step 5: Implement `lib/viewer.ts`**

```ts
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";
import { describeError } from "@/lib/describe-error";

export type Viewer = { signedIn: boolean; curator: boolean };

/**
 * Who is looking, for server components: memoized per request, so the header
 * and the page share one session read. A session that cannot be read counts
 * as signed out, as in AuthStatus, so an auth problem never blanks a page.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  try {
    const session = await auth();
    return { signedIn: Boolean(session?.user), curator: session?.curator === true };
  } catch (err) {
    unstable_rethrow(err);
    console.warn(`[viewer] could not read the session; treating as signed out (${describeError(err)})`);
    return { signedIn: false, curator: false };
  }
});
```

`lib/viewer.ts` imports `@/auth` (next-auth's server entry), so importing it from a client component fails the build. That keeps it server-side without a `server-only` import.

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run lib/__tests__/roles.test.ts lib/__tests__/viewer.test.ts lib/__tests__/auth-callbacks.test.ts && npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. Lint shows only the pre-existing `postcss.config.mjs` warning.

- [ ] **Step 7: Commit**

```bash
git add lib/roles.ts lib/viewer.ts auth.ts types/next-auth.d.ts lib/__tests__/roles.test.ts lib/__tests__/viewer.test.ts lib/__tests__/auth-callbacks.test.ts
git commit -S -m "feat: curator flag from Zitadel project roles, and getViewer()

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Review behind the curator gate, and the new header

**Files:**
- Create: `components/ReviewPage.tsx`, containing the current `app/review/page.tsx` code unchanged (its default export `ReviewPage`)
- Replace: `app/review/page.tsx`
- Modify: `components/SiteHeader.tsx`, `app/layout.tsx`
- Test: modify `components/__tests__/ReviewPage.test.tsx` (the import path); create `components/__tests__/ReviewGate.test.tsx` and `components/__tests__/SiteHeader.test.tsx`

**Interfaces:**
- Consumes: `getViewer()` (Task 4).
- Produces: `SiteHeader` (async server component), and `/review` returning 404 to non-curators.

- [ ] **Step 1: Move the review UI**

```bash
git mv app/review/page.tsx components/ReviewPage.tsx
sed -i 's#import ReviewPage from "@/app/review/page";#import ReviewPage from "@/components/ReviewPage";#' components/__tests__/ReviewPage.test.tsx
```

Run: `npx vitest run components/__tests__/ReviewPage.test.tsx`
Expected: PASS, unchanged behaviour.

- [ ] **Step 2: Write the failing tests**

Create `components/__tests__/ReviewGate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/ReviewPage", () => ({ default: () => <p>review ui</p> }));

import ReviewRoute from "@/app/review/page";

describe("/review gate", () => {
  beforeEach(() => viewerMock.mockReset());

  it("is a 404 when signed out", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    await expect(ReviewRoute()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for a signed-in reader without a curation role", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    await expect(ReviewRoute()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the review UI for a curator", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    const el = await ReviewRoute();
    expect(el).toBeTruthy();
  });
});
```

Create `components/__tests__/SiteHeader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("@/components/AuthStatus", () => ({ AuthStatus: () => <span>auth</span> }));

import { SiteHeader } from "@/components/SiteHeader";

describe("SiteHeader", () => {
  beforeEach(() => viewerMock.mockReset());

  it("links home and to Compare, and hides Review from non-curators", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Martyrology" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(screen.queryByRole("link", { name: "Review" })).not.toBeInTheDocument();
  });

  it("shows Review to curators", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/review");
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run components/__tests__/ReviewGate.test.tsx components/__tests__/SiteHeader.test.tsx`
Expected: FAIL. `@/app/review/page` no longer exists, and `SiteHeader` is not async and has no Compare link.

- [ ] **Step 4: Write the gate**

Create `app/review/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import ReviewPage from "@/components/ReviewPage";

// Change-set review is a back-office tool: curators only (admin or
// martyrology_editor). Everyone else gets a 404 rather than a hint it exists.
export default async function ReviewRoute() {
  const viewer = await getViewer();
  if (!viewer.curator) notFound();
  return <ReviewPage />;
}
```

- [ ] **Step 5: Rewrite the header and the title**

Replace `components/SiteHeader.tsx`:

```tsx
import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { getViewer } from "@/lib/viewer";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
        <Link href="/" className="font-serif text-lg font-semibold">
          Martyrology
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/compare">Compare</Link>
          {viewer.curator && <Link href="/review">Review</Link>}
          <AuthStatus />
        </nav>
      </div>
    </header>
  );
}
```

In `app/layout.tsx`, change the metadata to:

```ts
export const metadata = {
  title: "Roman Martyrology",
  description: "The editions of the Roman Martyrology, read day by day.",
};
```

- [ ] **Step 6: Run the tests and checks**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A app/review components/ReviewPage.tsx components/__tests__/ReviewPage.test.tsx components/__tests__/ReviewGate.test.tsx components/__tests__/SiteHeader.test.tsx components/SiteHeader.tsx app/layout.tsx
git commit -S -m "feat: limit /review to curators; header with Compare and Review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `BookCover`

**Files:**
- Create: `components/book.module.css`, `components/BookCover.tsx`
- Test: `components/__tests__/BookCover.test.tsx`

**Interfaces:**
- Consumes: `ShelfState`, `editionTitle`, `languageLabel`, `isOriginal` (Task 3); `EditionOut`.
- Produces: `BookCover({ edition, state, opening, onClick }: { edition: EditionOut; state: ShelfState; opening?: boolean; onClick?: () => void })`
  - Open and locked books render a `<button>` whose accessible name is `"<Title in title case> <year>, <language label>"`, followed by `" (locked)"` for locked books.
  - Unavailable books render a non-interactive `<div aria-disabled="true">` labelled `"… (not yet available)"`.

- [ ] **Step 1: Write the failing test**

Create `components/__tests__/BookCover.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BookCover from "@/components/BookCover";
import type { EditionOut } from "@/lib/types";

const e1749: EditionOut = {
  edition_id: "martyrologium_romanum_1749", year: 1749, locale: "la", nature: "editio_typica_recognita",
  book: "martyrologium", scope: {}, promulgation: {}, governance: { governing_body: "", type: "" },
  availability: { status: "public" },
};
const e2004it: EditionOut = { ...e1749, edition_id: "martyrologium_romanum_2004_it_IT", year: 2004, locale: "it-IT",
  nature: "editio_vernacula", availability: { status: "restricted-texts" } };

describe("BookCover", () => {
  it("is an openable book with title, year and language", () => {
    const onClick = vi.fn();
    render(<BookCover edition={e1749} state="open" onClick={onClick} />);
    const book = screen.getByRole("button", { name: "Martyrologium Romanum 1749, Latin" });
    expect(book).toHaveTextContent("MARTYROLOGIUM");
    expect(book).toHaveTextContent("1749");
    fireEvent.click(book);
    expect(onClick).toHaveBeenCalled();
  });

  it("is a locked book, still clickable to explain why", () => {
    const onClick = vi.fn();
    render(<BookCover edition={e2004it} state="locked" onClick={onClick} />);
    const book = screen.getByRole("button", { name: "Martirologio Romano 2004, Italiano (CEI) (locked)" });
    expect(book).toHaveTextContent("🔒");
    fireEvent.click(book);
    expect(onClick).toHaveBeenCalled();
  });

  it("is not interactive when unavailable", () => {
    const onClick = vi.fn();
    render(<BookCover edition={{ ...e1749, availability: { status: "unavailable" } }} state="unavailable" onClick={onClick} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const book = screen.getByLabelText("Martyrologium Romanum 1749, Latin (not yet available)");
    expect(book).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("not yet available")).toBeInTheDocument();
    fireEvent.click(book);
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/__tests__/BookCover.test.tsx`
Expected: FAIL, because `@/components/BookCover` cannot be resolved.

- [ ] **Step 3: Write the styles**

Create `components/book.module.css`:

```css
/* A tooled-leather book standing on the shelf, drawn in CSS. */
.slot { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; perspective: 900px; }
.book {
  position: relative; width: 7.5rem; height: 11rem; padding: 0; border: 0;
  border-radius: 2px 6px 6px 2px; font-family: Georgia, "Times New Roman", serif; color: #e9c46a;
  box-shadow: 2px 3px 7px rgba(0, 0, 0, 0.35);
  transform-origin: left center; transition: transform 0.35s ease, box-shadow 0.35s ease;
  cursor: pointer;
}
.open { background: linear-gradient(90deg, #5a0f12 0 10px, #8b1a1f 10px); }
.dark { background: linear-gradient(90deg, #3d0a0c 0 10px, #5e1216 10px); }
.locked { background: linear-gradient(90deg, #4a3638 0 10px, #6e5557 10px); color: #c9b9a0; }
.unavailable {
  background: repeating-linear-gradient(45deg, #e9e4df 0 6px, #f3efea 6px 12px);
  color: #9a8f86; border: 1px dashed #b8aca1; box-shadow: none; cursor: default;
}
.book:not(.unavailable):hover,
.book:not(.unavailable):focus-visible { transform: rotateY(-14deg); box-shadow: 8px 6px 16px rgba(0, 0, 0, 0.4); }
.opening { transform: rotateY(-75deg) !important; transition-duration: 0.45s; }
.frame { position: absolute; inset: 10px 8px 10px 18px; border: 1px solid currentColor; opacity: 0.55; border-radius: 1px; }
.title { position: absolute; top: 1.4rem; left: 1rem; right: 0.4rem; text-align: center; font-size: 0.7rem; letter-spacing: 0.08em; line-height: 1.4; }
.lock { position: absolute; top: 4.6rem; left: 0; right: 0; text-align: center; font-size: 1.3rem; opacity: 0.8; }
.year { position: absolute; bottom: 1rem; left: 0.6rem; right: 0; text-align: center; font-size: 1.1rem; }
.label { font-size: 0.75rem; color: #6b625b; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .book, .opening { transition: none; }
  .book:not(.unavailable):hover, .book:not(.unavailable):focus-visible, .opening { transform: none !important; }
}
```

- [ ] **Step 4: Write the component**

Create `components/BookCover.tsx`:

```tsx
import styles from "@/components/book.module.css";
import { editionTitle, isOriginal, languageLabel, type ShelfState } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One edition as a tooled-leather book. Presentational: the shelf decides what a click does. */
export default function BookCover({
  edition,
  state,
  opening = false,
  onClick,
}: {
  edition: EditionOut;
  state: ShelfState;
  opening?: boolean;
  onClick?: () => void;
}) {
  const title = editionTitle(edition);
  const label = languageLabel(edition);
  const name = `${titleCase(title)} ${edition.year}, ${label}`;
  const tone =
    state === "unavailable" ? styles.unavailable : state === "locked" ? styles.locked : isOriginal(edition) ? styles.open : styles.dark;
  const face = (
    <>
      <span className={styles.frame} aria-hidden />
      <span className={styles.title} aria-hidden>{title}</span>
      {state === "locked" && <span className={styles.lock} aria-hidden>🔒</span>}
      <span className={styles.year} aria-hidden>{edition.year}</span>
    </>
  );
  return (
    <div className={styles.slot}>
      {state === "unavailable" ? (
        <div className={`${styles.book} ${tone}`} aria-disabled="true" aria-label={`${name} (not yet available)`} role="img">
          {face}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.book} ${tone} ${opening ? styles.opening : ""}`}
          aria-label={state === "locked" ? `${name} (locked)` : name}
          onClick={onClick}
        >
          {face}
        </button>
      )}
      <span className={styles.label}>{state === "unavailable" ? "not yet available" : label}</span>
    </div>
  );
}
```

- [ ] **Step 5: Run the test and checks**

Run: `npx vitest run components/__tests__/BookCover.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS, 3 tests. If Vitest cannot import the CSS module, add `css: { modules: { classNameStrategy: "non-scoped" } }` under `test:` in `vitest.config.ts`.

- [ ] **Step 6: Commit**

```bash
git add components/book.module.css components/BookCover.tsx components/__tests__/BookCover.test.tsx
git commit -S -m "feat: tooled-leather BookCover in open, locked and unavailable states

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `LockedNotice`, `Bookshelf` and the landing page

**Files:**
- Create: `components/LockedNotice.tsx`, `components/Bookshelf.tsx`
- Replace: `app/page.tsx`
- Test: `components/__tests__/Bookshelf.test.tsx`

**Interfaces:**
- Consumes: `getEditions`, `getAccess`, `ApiError` (`lib/api.ts`, Task 3); `sortForShelf`, `shelfState`, `editionTitle` (Task 3); `BookCover` (Task 6); `getViewer` (Task 4).
- Produces:
  - `LockedNotice({ title, signedIn, accessInfo, onSignIn, onClose }: { title: string; signedIn: boolean; accessInfo?: string | null; onSignIn: () => void; onClose?: () => void })`
  - `Bookshelf({ signedIn }: { signedIn: boolean })`
  - Task 9 reuses `LockedNotice`.

- [ ] **Step 1: Write the failing test**

Create `components/__tests__/Bookshelf.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { push, signInMock } = vi.hoisted(() => ({ push: vi.fn(), signInMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => ({
  getEditions: vi.fn(),
  getAccess: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import Bookshelf from "@/components/Bookshelf";
import { getEditions, getAccess } from "@/lib/api";
import type { EditionOut } from "@/lib/types";

function ed(edition_id: string, year: number, locale: string, nature: string, status: string): EditionOut {
  return { edition_id, year, locale, nature, book: "martyrologium", scope: {}, promulgation: {},
    governance: { governing_body: "", type: "" }, availability: { status, note: status === "restricted-texts" ? "See https://example/licensing" : null } };
}
const EDITIONS = [
  ed("martyrologium_romanum_1749", 1749, "la", "editio_typica_recognita", "public"),
  ed("martyrologium_romanum_2004", 2004, "la", "editio_typica_altera", "restricted-texts"),
  ed("martyrologium_romanum_2001", 2001, "la", "editio_typica", "unavailable"),
];

beforeEach(() => {
  push.mockReset();
  signInMock.mockReset();
  vi.mocked(getEditions).mockResolvedValue(EDITIONS);
  vi.mocked(getAccess).mockResolvedValue({
    martyrologium_romanum_1749: { can_read_texts: true },
    martyrologium_romanum_2004: { can_read_texts: false },
    martyrologium_romanum_2001: { can_read_texts: true },
  });
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never; // reduced motion: open immediately
});

describe("Bookshelf", () => {
  it("shows the editions newest first", async () => {
    render(<Bookshelf signedIn={false} />);
    await screen.findByRole("button", { name: /1749/ });
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Martyrologium Romanum 2004, Latin (locked)", "Martyrologium Romanum 1749, Latin"]);
    expect(screen.getByLabelText(/2001, Latin \(not yet available\)/)).toBeInTheDocument();
  });

  it("opens an open book in the reader", async () => {
    render(<Bookshelf signedIn={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749");
  });

  it("asks a signed-out visitor to sign in for a locked book", async () => {
    render(<Bookshelf signedIn={false} />);
    fireEvent.click(await screen.findByRole("button", { name: /2004, Latin \(locked\)/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Sign in to open this edition");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signInMock).toHaveBeenCalledWith("zitadel");
    expect(push).not.toHaveBeenCalled();
  });

  it("tells a signed-in reader without rights that they have no access", async () => {
    render(<Bookshelf signedIn />);
    fireEvent.click(await screen.findByRole("button", { name: /2004, Latin \(locked\)/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Your account doesn't have access to this edition");
    expect(screen.getByRole("status")).toHaveTextContent("See https://example/licensing");
  });

  it("still shows every available book as open when access cannot be loaded", async () => {
    vi.mocked(getAccess).mockRejectedValue(new Error("down"));
    render(<Bookshelf signedIn={false} />);
    expect(await screen.findByRole("button", { name: "Martyrologium Romanum 2004, Latin" })).toBeInTheDocument();
  });

  it("offers a retry when the editions cannot be loaded", async () => {
    vi.mocked(getEditions).mockRejectedValueOnce(new Error("down"));
    render(<Bookshelf signedIn={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/__tests__/Bookshelf.test.tsx`
Expected: FAIL, because `@/components/Bookshelf` cannot be resolved.

- [ ] **Step 3: Write `LockedNotice`**

Create `components/LockedNotice.tsx`:

```tsx
/** Why a copyrighted edition will not open, and what the reader can do about it. */
export default function LockedNotice({
  title,
  signedIn,
  accessInfo,
  onSignIn,
  onClose,
}: {
  title: string;
  signedIn: boolean;
  accessInfo?: string | null;
  onSignIn: () => void;
  onClose?: () => void;
}) {
  return (
    <div role="status" className="mx-auto mt-6 max-w-xl rounded border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <p className="font-semibold">{title} is a copyrighted edition.</p>
      {signedIn ? (
        <p className="mt-1">
          Your account doesn&apos;t have access to this edition.
          {accessInfo && <span className="mt-1 block text-slate-600 dark:text-slate-400">{accessInfo}</span>}
        </p>
      ) : (
        <p className="mt-1 flex items-center gap-3">
          Sign in to open this edition.
          <button type="button" className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700" onClick={onSignIn}>
            Sign in
          </button>
        </p>
      )}
      {onClose && (
        <button type="button" className="mt-2 text-xs underline" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `Bookshelf`**

Create `components/Bookshelf.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import BookCover from "@/components/BookCover";
import LockedNotice from "@/components/LockedNotice";
import { getAccess, getEditions } from "@/lib/api";
import { editionTitle, shelfState, sortForShelf } from "@/lib/editions";
import type { AccessMap, EditionOut } from "@/lib/types";

const OPEN_MS = 450;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Bookshelf({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [editions, setEditions] = useState<EditionOut[] | null>(null);
  const [access, setAccess] = useState<AccessMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState<EditionOut | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [eds, acc] = await Promise.all([getEditions(), getAccess().catch(() => null)]);
      setEditions(sortForShelf(eds));
      setAccess(acc);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (e: EditionOut) => {
    const path = `/read/${encodeURIComponent(e.edition_id)}`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(path);
      return;
    }
    setOpening(e.edition_id);
    window.setTimeout(() => router.push(path), OPEN_MS);
  };

  if (failed) {
    return (
      <p className="mt-10 text-center">
        The editions could not be loaded.{" "}
        <button type="button" className="underline" onClick={() => void load()}>
          Retry
        </button>
      </p>
    );
  }

  return (
    <section aria-label="Editions of the Roman Martyrology">
      <div className="flex flex-wrap items-end justify-center gap-6 border-b-[10px] border-[#6b4a2e] px-4 pb-4 pt-8">
        {editions === null
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-44 w-30 animate-pulse rounded bg-slate-200 dark:bg-slate-800" aria-hidden />
            ))
          : editions.map((e) => {
              const state = shelfState(e, access);
              return (
                <BookCover
                  key={e.edition_id}
                  edition={e}
                  state={state}
                  opening={opening === e.edition_id}
                  onClick={state === "open" ? () => open(e) : state === "locked" ? () => setLocked(e) : undefined}
                />
              );
            })}
      </div>
      {locked && (
        <LockedNotice
          title={`${titleCase(editionTitle(locked))} ${locked.year}`}
          signedIn={signedIn}
          accessInfo={locked.availability.note}
          onSignIn={() => void signIn("zitadel")}
          onClose={() => setLocked(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 5: Replace the landing page**

Replace `app/page.tsx`:

```tsx
import Bookshelf from "@/components/Bookshelf";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const viewer = await getViewer();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-center font-serif text-3xl">Martyrologium Romanum</h1>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
        The editions of the Roman Martyrology, newest to oldest. Open a book to read today&apos;s page.
      </p>
      <Bookshelf signedIn={viewer.signedIn} />
    </main>
  );
}
```

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run components/__tests__/Bookshelf.test.tsx && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS, 6 tests; the full suite, tsc, lint and build all green. The route table must still list `/` as dynamic (ƒ).

- [ ] **Step 7: Commit**

```bash
git add components/LockedNotice.tsx components/Bookshelf.tsx components/__tests__/Bookshelf.test.tsx app/page.tsx
git commit -S -m "feat: bookshelf landing page with locked-edition notice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `DayPage`

**Files:**
- Create: `components/page.module.css`, `components/DayPage.tsx`
- Test: `components/__tests__/DayPage.test.tsx`

**Interfaces:**
- Consumes: `DayContentOut` (`lib/types.ts`).
- Produces: `DayPage({ day, heading }: { day: DayContentOut; heading: string })`. `heading` is shown when `day.titulus` is null or empty; otherwise the titulus is the heading.

- [ ] **Step 1: Write the failing test**

Create `components/__tests__/DayPage.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DayPage from "@/components/DayPage";

const day = {
  titulus: "2 Octobris Sexto Nonas Octobris. xxj. B",
  elogia: [
    { id: "mr:1002-angeli-custodes", entry: 1, asterisk: false, unnumbered: true, anchor_day: "10-02", text: "Festum sanctorum Angelorum Custodum." },
    { id: "mr:1002-modestus-sardus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "10-02", text: "Romae passio sancti Modesti Sardi." },
    { id: "mr:1002-x", entry: 3, asterisk: true, unnumbered: false, anchor_day: "10-02", text: "Alibi sancti X." },
  ],
  conclusio: "Et alibi aliorum plurimorum sanctorum Martyrum. R. Deo gratias.",
};

describe("DayPage", () => {
  it("uses the edition's titulus as the heading", () => {
    render(<DayPage day={day} heading="2 Octobris" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 Octobris Sexto Nonas Octobris. xxj. B");
  });

  it("falls back to the computed heading when the edition prints no titulus", () => {
    render(<DayPage day={{ ...day, titulus: null }} heading="2 ottobre" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 ottobre");
  });

  it("prints numbers and asterisks as rubrics, and headers unnumbered", () => {
    render(<DayPage day={day} heading="" />);
    const header = screen.getByText("Festum sanctorum Angelorum Custodum.");
    expect(header.closest("p")).toHaveAttribute("data-unnumbered", "true");
    expect(header.closest("p")).not.toHaveTextContent(/^1/);
    expect(screen.getByText("Romae passio sancti Modesti Sardi.").closest("p")).toHaveTextContent(/^2\s*Romae/);
    expect(screen.getByText("Alibi sancti X.").closest("p")).toHaveTextContent(/^\*\s*3\s*Alibi/);
  });

  it("closes with the conclusio, setting R. as a rubric, and omits an empty one", () => {
    const { rerender } = render(<DayPage day={day} heading="" />);
    expect(screen.getByText("R.")).toBeInTheDocument();
    rerender(<DayPage day={{ ...day, conclusio: "" }} heading="" />);
    expect(screen.queryByText("R.")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/__tests__/DayPage.test.tsx`
Expected: FAIL, because `@/components/DayPage` cannot be resolved.

- [ ] **Step 3: Write the styles**

Create `components/page.module.css`:

```css
/* One printed page of the Martyrology: cream paper, serif text, red rubrics. */
.page {
  max-width: 38rem; margin: 0 auto; padding: 2rem 2.25rem; min-height: 24rem;
  background: #fbf6ec; color: #2a1a10; font-family: Georgia, "Times New Roman", serif;
  font-size: 1.05rem; line-height: 1.6; box-shadow: inset 0 0 40px rgba(120, 80, 40, 0.08), 0 2px 10px rgba(0, 0, 0, 0.12);
}
.heading { color: #a3161b; text-align: center; font-size: 1.15rem; font-weight: normal; margin-bottom: 1rem; }
.rubric { color: #a3161b; font-size: 0.85em; margin-right: 0.35em; }
.entry { margin: 0.6rem 0; }
.unnumbered { text-align: center; font-style: italic; }
.conclusio { margin-top: 1rem; font-style: italic; }
.conclusio .rubric { font-style: normal; }
.turnNext { animation: turnNext 0.4s ease; transform-origin: left center; }
.turnPrev { animation: turnPrev 0.4s ease; transform-origin: right center; }
@keyframes turnNext { from { opacity: 0.2; transform: perspective(1200px) rotateY(18deg); } to { opacity: 1; transform: none; } }
@keyframes turnPrev { from { opacity: 0.2; transform: perspective(1200px) rotateY(-18deg); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .turnNext, .turnPrev { animation: fade 0.2s ease; transform: none; }
  @keyframes fade { from { opacity: 0.4; } to { opacity: 1; } }
}
```

- [ ] **Step 4: Write the component**

Create `components/DayPage.tsx`:

```tsx
import styles from "@/components/page.module.css";
import type { DayContentOut } from "@/lib/types";

/** Split "… R. Deo gratias." so the response mark can be set as a rubric. */
function Conclusio({ text }: { text: string }) {
  const at = text.lastIndexOf("R.");
  if (at < 0) return <p className={styles.conclusio}>{text}</p>;
  return (
    <p className={styles.conclusio}>
      {text.slice(0, at)}
      <span className={styles.rubric}>R.</span>
      {text.slice(at + 2)}
    </p>
  );
}

/** One day typeset as a printed page. `heading` is used when the edition prints no titulus. */
export default function DayPage({ day, heading }: { day: DayContentOut; heading: string }) {
  return (
    <article className={styles.page}>
      <h2 className={styles.heading}>{day.titulus || heading}</h2>
      {day.elogia.map((e, i) =>
        e.unnumbered ? (
          <p key={e.id ?? i} className={`${styles.entry} ${styles.unnumbered}`} data-unnumbered="true">
            {e.text}
          </p>
        ) : (
          <p key={e.id ?? i} className={styles.entry}>
            <span className={styles.rubric}>
              {e.asterisk ? "* " : ""}
              {e.entry}
            </span>
            {e.text}
          </p>
        ),
      )}
      {day.conclusio && <Conclusio text={day.conclusio} />}
    </article>
  );
}
```

- [ ] **Step 5: Run the test and checks**

Run: `npx vitest run components/__tests__/DayPage.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add components/page.module.css components/DayPage.tsx components/__tests__/DayPage.test.tsx
git commit -S -m "feat: DayPage typesets one day with red rubrics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The reader: `ReaderBar`, `Reader` and the `/read` routes

**Files:**
- Create: `components/ReaderBar.tsx`, `components/Reader.tsx`, `components/TodayRedirect.tsx`, `lib/server-editions.ts`, `app/read/[edition]/page.tsx`, `app/read/[edition]/[mm]/[dd]/page.tsx`
- Test: `components/__tests__/Reader.test.tsx`, `components/__tests__/ReadRoutes.test.tsx`

**Interfaces:**
- Consumes:
  - `Day`, `nextDay`, `prevDay`, `todayLocal`, `dayPath`, `daysInMonth`, `monthName`, `dateHeading`, `parseDay`, `pad2` (Task 2);
  - `getDay`, `getEditions`, `getAccess`, `ApiError` (Task 3);
  - `editionLang`, `editionTitle`, `shelfState`, `sortForShelf` (Task 3);
  - `DayPage` (Task 8), `LockedNotice` (Task 7), `getViewer` (Task 4).
- Produces:
  - `ReaderBar({ edition, day, books, onGo, onSwitch })`, where `books: { id: string; label: string }[]`
  - `Reader({ edition, mm, dd, signedIn }: { edition: string; mm: number; dd: number; signedIn: boolean })`
  - `editionExists(id: string): Promise<boolean>` (server)
  - the routes `/read/[edition]` and `/read/[edition]/[mm]/[dd]`

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/Reader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { push, signInMock } = vi.hoisted(() => ({ push: vi.fn(), signInMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getDay: vi.fn(), getEditions: vi.fn(), getAccess: vi.fn(), ApiError };
});

import Reader from "@/components/Reader";
import { getDay, getEditions, getAccess, ApiError } from "@/lib/api";
import type { EditionOut } from "@/lib/types";

function ed(edition_id: string, year: number, locale: string, nature: string, status: string): EditionOut {
  return { edition_id, year, locale, nature, book: "martyrologium", scope: {}, promulgation: {},
    governance: { governing_body: "", type: "" }, availability: { status } };
}
const DAY = {
  titulus: "2 Octobris Sexto Nonas Octobris. xxj. B",
  elogia: [{ id: "mr:1002-modestus-sardus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "10-02", text: "Romae passio sancti Modesti Sardi." }],
  conclusio: null,
  metadata: { edition: "martyrologium_romanum_1749", month: 10, day: 2, access: "public" },
};

beforeEach(() => {
  push.mockReset();
  vi.mocked(getDay).mockResolvedValue(DAY);
  vi.mocked(getEditions).mockResolvedValue([
    ed("martyrologium_romanum_1749", 1749, "la", "editio_typica_recognita", "public"),
    ed("martyrologium_romanum_1914_en_unofficial", 1914, "en", "translatio", "public"),
    ed("martyrologium_romanum_2004", 2004, "la", "editio_typica_altera", "restricted-texts"),
  ]);
  vi.mocked(getAccess).mockResolvedValue({
    martyrologium_romanum_1749: { can_read_texts: true },
    martyrologium_romanum_1914_en_unofficial: { can_read_texts: true },
    martyrologium_romanum_2004: { can_read_texts: false },
  });
});

const render1749 = (mm = 10, dd = 2, signedIn = false) =>
  render(<Reader edition="martyrologium_romanum_1749" mm={mm} dd={dd} signedIn={signedIn} />);

describe("Reader", () => {
  it("shows the day's page", async () => {
    render1749();
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
    expect(getDay).toHaveBeenCalledWith("martyrologium_romanum_1749", "10", "02");
  });

  it("turns to the next and previous day, wrapping the year", async () => {
    render1749(12, 31);
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/01/01");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/12/30");
  });

  it("leaves the arrow keys to a focused picker", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const month = screen.getByLabelText("Month");
    month.focus();
    fireEvent.keyDown(month, { key: "ArrowRight" });
    expect(push).not.toHaveBeenCalled();
  });

  it("jumps with the pickers, and Switch book keeps the date and lists only openable books", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/10/15");
    const switcher = screen.getByLabelText("Switch book");
    expect([...switcher.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "martyrologium_romanum_1914_en_unofficial", "martyrologium_romanum_1749",
    ]);
    fireEvent.change(switcher, { target: { value: "martyrologium_romanum_1914_en_unofficial" } });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1914_en_unofficial/10/02");
  });

  it("shows the locked notice, not blank eulogies, for a redacted edition", async () => {
    vi.mocked(getDay).mockResolvedValue({ ...DAY, elogia: [{ ...DAY.elogia[0], text: null }],
      metadata: { ...DAY.metadata, access: "restricted-texts", access_info: "https://example/licensing" } });
    render(<Reader edition="martyrologium_romanum_2004" mm={10} dd={2} signedIn={false} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Sign in to open this edition");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("says when the edition has no text for the day, and keeps the controls", async () => {
    vi.mocked(getDay).mockRejectedValue(new ApiError(404, "No entries for this day"));
    render(<Reader edition="martyrologium_romanum_1914_en_unofficial" mm={10} dd={2} signedIn={false} />);
    expect(await screen.findByText("This edition has no text for 2 October.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1914_en_unofficial/10/03");
  });

  it("offers a retry when the API is unreachable", async () => {
    vi.mocked(getDay).mockRejectedValueOnce(new ApiError(502, "API unreachable"));
    render1749();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
  });
});
```

Create `components/__tests__/ReadRoutes.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const { existsMock, viewerMock } = vi.hoisted(() => ({ existsMock: vi.fn(), viewerMock: vi.fn() }));
vi.mock("@/lib/server-editions", () => ({ editionExists: existsMock }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/components/Reader", () => ({ default: () => null }));
vi.mock("@/components/TodayRedirect", () => ({ default: () => null }));

import DayRoute from "@/app/read/[edition]/[mm]/[dd]/page";
import EditionRoute from "@/app/read/[edition]/page";

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

describe("/read routes", () => {
  beforeEach(() => {
    existsMock.mockReset().mockResolvedValue(true);
    viewerMock.mockReset().mockResolvedValue({ signedIn: false, curator: false });
  });

  it("404s on an invalid day", async () => {
    await expect(DayRoute(params({ edition: "martyrologium_romanum_1749", mm: "02", dd: "30" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(DayRoute(params({ edition: "martyrologium_romanum_1749", mm: "2", dd: "01" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s on an unknown edition", async () => {
    existsMock.mockResolvedValue(false);
    await expect(DayRoute(params({ edition: "nope", mm: "01", dd: "01" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(EditionRoute(params({ edition: "nope" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a valid day, including 29 February", async () => {
    expect(await DayRoute(params({ edition: "martyrologium_romanum_1749", mm: "02", dd: "29" }))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run components/__tests__/Reader.test.tsx components/__tests__/ReadRoutes.test.tsx`
Expected: FAIL, because the modules cannot be resolved.

- [ ] **Step 3: Write `lib/server-editions.ts`**

```ts
const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

/**
 * Whether the API knows this edition, so /read can 404 on a mistyped link.
 * If the API cannot be asked, assume yes: the reader then shows its own
 * "unreachable" state rather than a misleading 404.
 */
export async function editionExists(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/editions`, { next: { revalidate: 3600 } });
    if (!res.ok) return true;
    const body = (await res.json()) as { editions: { edition_id: string }[] };
    return body.editions.some((e) => e.edition_id === id);
  } catch {
    return true;
  }
}
```

- [ ] **Step 4: Write `ReaderBar`**

Create `components/ReaderBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { daysInMonth, monthName, todayLocal, type Day } from "@/lib/calendar";

const control = "rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900";

export default function ReaderBar({
  edition,
  day,
  books,
  onGo,
  onSwitch,
}: {
  edition: string;
  day: Day;
  books: { id: string; label: string }[];
  onGo: (d: Day) => void;
  onSwitch: (edition: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="reader-month">Month</label>
      <select
        id="reader-month"
        className={control}
        value={day.mm}
        onChange={(e) => {
          const mm = Number(e.target.value);
          onGo({ mm, dd: Math.min(day.dd, daysInMonth(mm)) });
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{monthName(i + 1, "en")}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="reader-day">Day</label>
      <select id="reader-day" className={control} value={day.dd} onChange={(e) => onGo({ mm: day.mm, dd: Number(e.target.value) })}>
        {Array.from({ length: daysInMonth(day.mm) }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <button type="button" className={control} onClick={() => onGo(todayLocal())}>Today</button>
      <label className="sr-only" htmlFor="reader-book">Switch book</label>
      <select id="reader-book" className={`${control} ml-auto`} value={edition} onChange={(e) => onSwitch(e.target.value)}>
        {books.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
      <Link href="/" className="text-sm underline">⟵ Shelf</Link>
    </div>
  );
}
```

If the opened edition is not in `books` (for example, locked), the switcher shows the first option. The reader then adds the current edition so the select stays truthful; see Step 5's `books` computation.

- [ ] **Step 5: Write `Reader`**

Create `components/Reader.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import DayPage from "@/components/DayPage";
import LockedNotice from "@/components/LockedNotice";
import ReaderBar from "@/components/ReaderBar";
import styles from "@/components/page.module.css";
import { ApiError, getAccess, getDay, getEditions } from "@/lib/api";
import { dateHeading, dayPath, monthName, nextDay, pad2, prevDay, type Day } from "@/lib/calendar";
import { editionLang, editionTitle, shelfState, sortForShelf } from "@/lib/editions";
import type { AccessMap, DayOut, EditionOut } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; day: DayOut }
  | { kind: "locked"; accessInfo: string | null }
  | { kind: "notext" }
  | { kind: "error" };

const SWIPE_PX = 50;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isFormField(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && ["SELECT", "INPUT", "TEXTAREA"].includes(t.tagName);
}

export default function Reader({ edition, mm, dd, signedIn }: { edition: string; mm: number; dd: number; signedIn: boolean }) {
  const router = useRouter();
  const day = useMemo<Day>(() => ({ mm, dd }), [mm, dd]);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [editions, setEditions] = useState<EditionOut[]>([]);
  const [access, setAccess] = useState<AccessMap | null>(null);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);
  const touchX = useRef<number | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const data = await getDay(edition, pad2(mm), pad2(dd));
      if (data.metadata.access === "restricted-texts") {
        setState({ kind: "locked", accessInfo: data.metadata.access_info ?? null });
      } else {
        setState({ kind: "ready", day: data });
      }
    } catch (err) {
      setState(err instanceof ApiError && err.status === 404 ? { kind: "notext" } : { kind: "error" });
    }
  }, [edition, mm, dd]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([getEditions(), getAccess().catch(() => null)])
      .then(([eds, acc]) => {
        setEditions(sortForShelf(eds));
        setAccess(acc);
      })
      .catch(() => undefined);
  }, []);

  const go = useCallback(
    (d: Day, direction: "next" | "prev" | null = null) => {
      setTurn(direction);
      router.push(dayPath(edition, d));
    },
    [router, edition],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isFormField(e.target)) return;
      if (e.key === "ArrowRight") go(nextDay(day), "next");
      if (e.key === "ArrowLeft") go(prevDay(day), "prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, go]);

  const current = editions.find((e) => e.edition_id === edition);
  const lang = current ? editionLang(current) : "la";
  const title = current ? `${titleCase(editionTitle(current))} ${current.year}` : edition;
  const books = useMemo(() => {
    const openable = editions.filter((e) => shelfState(e, access) === "open");
    const list = openable.some((e) => e.edition_id === edition) || !current ? openable : [current, ...openable];
    return list.map((e) => ({ id: e.edition_id, label: `${titleCase(editionTitle(e))} ${e.year}` }));
  }, [editions, access, edition, current]);

  return (
    <div>
      <ReaderBar edition={edition} day={day} books={books} onGo={(d) => go(d)} onSwitch={(id) => router.push(dayPath(id, day))} />
      <div
        className="flex items-stretch gap-2"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (dx <= -SWIPE_PX) go(nextDay(day), "next");
          if (dx >= SWIPE_PX) go(prevDay(day), "prev");
        }}
      >
        <button type="button" aria-label="Previous day" className="px-2 text-3xl text-[#8b1a1f] opacity-60 hover:opacity-100" onClick={() => go(prevDay(day), "prev")}>‹</button>
        <div className="flex-1">
          {state.kind === "loading" && <div className="mx-auto min-h-96 max-w-[38rem] animate-pulse rounded bg-[#fbf6ec]" aria-label="Loading" />}
          {state.kind === "ready" && (
            <div key={`${mm}-${dd}`} className={turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined}>
              <DayPage day={state.day} heading={dateHeading(day, lang)} />
            </div>
          )}
          {state.kind === "locked" && (
            <LockedNotice title={title} signedIn={signedIn} accessInfo={state.accessInfo} onSignIn={() => void signIn("zitadel")} />
          )}
          {state.kind === "notext" && (
            <p className="mt-10 text-center">This edition has no text for {dd} {monthName(mm, "en")}.</p>
          )}
          {state.kind === "error" && (
            <p className="mt-10 text-center">
              The text could not be loaded.{" "}
              <button type="button" className="underline" onClick={() => void load()}>Retry</button>
            </p>
          )}
        </div>
        <button type="button" aria-label="Next day" className="px-2 text-3xl text-[#8b1a1f] opacity-60 hover:opacity-100" onClick={() => go(nextDay(day), "next")}>›</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `TodayRedirect` and the routes**

Create `components/TodayRedirect.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dayPath, todayLocal } from "@/lib/calendar";

/** "Today" depends on the reader's timezone, so it is decided in the browser. */
export default function TodayRedirect({ edition }: { edition: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(dayPath(edition, todayLocal()));
  }, [router, edition]);
  return <p className="mt-10 text-center text-slate-500">Opening today&apos;s page…</p>;
}
```

Create `app/read/[edition]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import TodayRedirect from "@/components/TodayRedirect";
import { editionExists } from "@/lib/server-editions";

export default async function EditionRoute({ params }: { params: Promise<{ edition: string }> }) {
  const { edition } = await params;
  if (!(await editionExists(edition))) notFound();
  return <TodayRedirect edition={edition} />;
}
```

Create `app/read/[edition]/[mm]/[dd]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Reader from "@/components/Reader";
import { parseDay } from "@/lib/calendar";
import { editionExists } from "@/lib/server-editions";
import { getViewer } from "@/lib/viewer";

export default async function DayRoute({ params }: { params: Promise<{ edition: string; mm: string; dd: string }> }) {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day || !(await editionExists(edition))) notFound();
  const viewer = await getViewer();
  return (
    <main className="mx-auto max-w-5xl p-4">
      <Reader edition={edition} mm={day.mm} dd={day.dd} signedIn={viewer.signedIn} />
    </main>
  );
}
```

`edition` arrives URL-decoded from Next. Edition IDs are plain `[a-z0-9_]`, so no further decoding is needed.

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run components/__tests__/Reader.test.tsx components/__tests__/ReadRoutes.test.tsx && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS, 7 + 3 new tests; the full suite, tsc, lint and build all green. The build's route table must list `/read/[edition]` and `/read/[edition]/[mm]/[dd]` as dynamic (ƒ).

**Lint note, for Tasks 7 and 9 alike:** if `npm run lint` reports `react-hooks/set-state-in-effect` for the loading effects, do not disable the rule. Restructure instead:
- initialise the state as loading (`useState<State>({ kind: "loading" })` / `editions === null`);
- set the loading state only in the event handlers that start a reload (Retry), not synchronously in the effect body;
- for a change of day, key the reader's content on `${edition}/${mm}/${dd}` so React resets it.

- [ ] **Step 8: Commit**

```bash
git add components/ReaderBar.tsx components/Reader.tsx components/TodayRedirect.tsx lib/server-editions.ts "app/read" components/__tests__/Reader.test.tsx components/__tests__/ReadRoutes.test.tsx
git commit -S -m "feat: single-page reader with page turning, pickers and Switch book

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: README and local verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above. Task 1's API endpoint must be running in the local stack, so rebuild it.

- [ ] **Step 1: Document the new pages**

In `README.md`, replace the bullet list that names `/compare` and `/review` (the "Run the dev server" section's `http://localhost:3000/compare` and `/review` lines) with:

```markdown
- [http://localhost:3000](http://localhost:3000): the bookshelf of editions
- `http://localhost:3000/read/<edition>/<mm>/<dd>`: the reader, for example `/read/martyrologium_romanum_1749/10/02`
- [http://localhost:3000/compare](http://localhost:3000/compare): compare two editions
- [http://localhost:3000/review](http://localhost:3000/review): change-set review, for curators only. It needs the Zitadel project role `admin` or `martyrology_editor`, read at sign-in.
```

- [ ] **Step 2: Run the full verification**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 3: Rebuild the local stack with this branch and the API branch**

```bash
git -C ../martyrology-api switch feat/access-endpoint
docker compose up -d --build martyrology-api martyrology-frontend
```

Check:
- `curl -s http://localhost:3000/api/mr/access | jq .` lists every edition with the 2004 ones `false` while signed out.
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/review` returns `404`.
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/read/martyrologium_romanum_1749/02/30` returns `404`.

Then switch `../martyrology-api` back: `git -C ../martyrology-api switch main`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -S -m "docs: README for the bookshelf, reader and curator-only review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The **manual acceptance check is the user's.** The local root user has superuser in OpenFGA (so it can read the 2004 texts), but not necessarily a Zitadel *project role*. For Review to show, first grant it `martyrology_editor`:
- open the local Zitadel console;
- go to Martyrology org → Projects → MartyrologyAPI → Authorizations;
- add that role to the root user;
- sign out and back in.

Then, on the local stack, signed in as that curator with `can_read_texts`:
- the 2004 books are open and Review shows in the header;
- page turning, the pickers, Switch book and Today work;
- signed out, the 2004 books are locked with the sign-in notice, and Review is hidden.
