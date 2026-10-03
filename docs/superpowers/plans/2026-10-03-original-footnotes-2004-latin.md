# Original footnotes, slice 1 (API, reader, 2004 Latin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve and show the printed footnotes of the editions, starting with the Latin editio typica altera 2004, extracted from its PDF.

**Architecture:** Each edition may carry a `footnotes.json` beside its monthly files, keyed by canonical id. The API loads it and adds `footnotes` to every eulogy it serves, emptied wherever the text is redacted. The reader places each printed mark after its anchor phrase and lists the footnotes at the foot of the page, before the curators' notes. A rerunnable script in `martyrology-texts` extracts the Latin footnotes from the PDF's OCR layer by layout, maps them to canonical ids through the CRMEDR registry, and applies a proofreading overrides file last.

**Tech Stack:** Python 3 with PyMuPDF (`fitz`) and pytest (system `python3`) for `martyrology-texts`; FastAPI, Pydantic and pytest (the repo's `.venv`) for `martyrology-api`; Next.js 16, React 19 and Vitest for `martyrology-frontend`.

**Spec:** `docs/superpowers/specs/2026-10-03-original-footnotes-design.md` (branch `docs/original-footnotes`).

## Global Constraints

- Source of the texts: **the PDFs** in `C:\Users\johnr\Documents\LitCal\Roman Martyrology` (WSL: `/mnt/c/Users/johnr/Documents/LitCal/Roman Martyrology`). Never the workbooks.
- Footnotes are **always shown**, not behind the IDs switch.
- Marks are **as printed** (`"1"`, `"12"`, `"*"`), stored as strings, never renumbered. The Latin numbers restart at 1 each month.
- Curators' notes keep their **red daggers** (†, ††, …) in their own block; printed marks are set in the **text colour**.
- A footnote whose `after` phrase doesn't occur exactly once as whole words: mark at the **end of the eulogy**, note still listed, and the extraction reports it.
- Each sheet of the parallel view shows **only its own** footnotes.
- Footnotes are text: wherever `text` is redacted (`restricted-texts`), `footnotes` is `[]`.
- `martyrology-texts` is **private and copyrighted**. Never copy its data, the PDF, or crops of the PDF into a public repo; test fixtures in public repos are invented text.
- The Praenotanda's footnotes, Baronius (1584), and editing footnotes through the curation API are out of scope.
- One branch per repo, `feat/original-footnotes`, one pull request per repo. Commit after each task.

## Review Focus

1. **The anchor phrase stops matching** (the eulogy text was proofread after extraction, or the phrase occurs twice): the mark goes at the end of the eulogy and the note is still listed. Pinned in Task 3.
2. **A footnote mark right after a misprinted word:** both the mark and the `[sic! …]` note appear, the mark directly after the word. Pinned in Task 4.
3. **A restricted edition:** no footnote text leaks to an anonymous reader, on the day route or on `/elogium/{id}`. Pinned in Task 2.
4. **A footnote set on the page after its mark, or running over to the next page:** it's paired with its mark, and its text is whole. Pinned in Task 5.
5. **An API or test fixture without the `footnotes` field** (an older deployment, the curation views): the page renders exactly as before. Pinned in Task 4.

---

## File map

**martyrology-api**
- Modify `src/martyrology_api/models.py`: `FootnoteOut`; a `footnotes` field on `ElogiumOut` and `EditionPlacementOut`.
- Modify `src/martyrology_api/store.py`: `Store.footnotes(edition_id)`.
- Modify `src/martyrology_api/routers/read.py`: attach footnotes in `elogium_out`, `_day_content` and `get_elogium`.
- Modify `src/martyrology_api/licensing.py`: `redact` also empties `footnotes`.
- Create `tests/fixtures/editions_private/martyrologium_romanum_2004/footnotes.json` (invented text).
- Modify `tests/test_store.py`, `tests/test_licensing_api.py`.
- Modify `data/editions/README.md`: document `footnotes.json`.

**martyrology-frontend**
- Modify `lib/types.ts`: `Footnote`; optional `footnotes` on `ElogiumOut` and `EditionPlacement`.
- Modify `lib/misprints.ts`: export `wholeWordRegExp`, used by both misprints and footnotes.
- Create `lib/footnotes.ts`: `PageFootnote`, `pageFootnotes`, `footnoteOffsets`.
- Create `components/PrintedFootnotes.tsx`: `FootnoteMark` and the foot-of-page list.
- Modify `components/EulogyText.tsx`, `components/Eulogy.tsx`, `components/DayPage.tsx`, `components/Spread.tsx`, `components/page.module.css`.
- Tests: `lib/__tests__/footnotes.test.ts` (new), `components/__tests__/DayPage.test.tsx`, `components/__tests__/Spread.test.tsx`.

**martyrology-texts**
- Create `scripts/extract_footnotes.py`: layout scan, pairing, id mapping, anchor phrases, overrides, CLI.
- Create `tests/conftest.py`, `tests/test_extract_footnotes.py`.
- Create `data/editions/martyrologium_romanum_2004/footnotes.json` (generated) and `footnotes-overrides.json` (hand-kept).
- Modify `README.md`; create or extend `.gitignore` with `footnote-crops/`.

---

### Task 1: API: load `footnotes.json`

**Repo:** `martyrology-api`, branch `feat/original-footnotes` from `main`.

**Files:**
- Modify: `src/martyrology_api/store.py` (class `Store`)
- Create: `tests/fixtures/editions_private/martyrologium_romanum_2004/footnotes.json`
- Test: `tests/test_store.py`

**Interfaces:**
- Produces: `Store.footnotes(edition_id: str) -> dict[str, list[dict]]`. Each dict has `mark: str`, `after: str | None`, `text: str`. Returns `{}` for an edition with no file or no texts.

- [ ] **Step 1: Create the fixture** (invented text; the fixture registry has `mr:0102-argeus-et-socii`, whose fixture text is "Tomis in Scythia, sanctorum Argei et sociorum martyrum.")

`tests/fixtures/editions_private/martyrologium_romanum_2004/footnotes.json`:
```json
{
  "mr:0102-argeus-et-socii": [
    { "mark": "1", "after": "sociorum", "text": "Quorum nomina: sancti Narcissus et Marcellinus." }
  ]
}
```

- [ ] **Step 2: Write the failing tests** (append to `tests/test_store.py`)

```python
def test_footnotes_loaded_by_id(crmedr_path, clbdr_path, data_paths):
    s = make_store(crmedr_path, clbdr_path, data_paths)
    assert s.footnotes("martyrologium_romanum_2004") == {
        "mr:0102-argeus-et-socii": [
            {"mark": "1", "after": "sociorum", "text": "Quorum nomina: sancti Narcissus et Marcellinus."}
        ]
    }


def test_footnotes_empty_without_a_file_or_texts(crmedr_path, clbdr_path, data_paths):
    s = make_store(crmedr_path, clbdr_path, data_paths)
    assert s.footnotes("martyrologium_romanum_1749") == {}
    assert s.footnotes("no_such_edition") == {}
```

- [ ] **Step 3: Run them to see them fail**

Run: `.venv/bin/pytest tests/test_store.py -q -k footnotes`
Expected: FAIL with `AttributeError: 'Store' object has no attribute 'footnotes'`.

- [ ] **Step 4: Implement** (in `Store.__init__` add the cache; add the method after `source`)

```python
        self._footnotes: dict[str, dict[str, list[dict]]] = {}
```

```python
    def footnotes(self, edition_id: str) -> dict[str, list[dict]]:
        """The printed footnotes of the edition's eulogies (`footnotes.json`
        beside its monthly files), by canonical id: each has the printed
        `mark`, the phrase it follows (`after`, or null when it couldn't be
        anchored) and its `text`. Empty when the edition has none."""
        if edition_id not in self._footnotes:
            d = self._dirs.get(edition_id)
            f = d / "footnotes.json" if d is not None else None
            self._footnotes[edition_id] = (
                json.loads(f.read_text(encoding="utf-8")) if f is not None and f.exists() else {}
            )
        return self._footnotes[edition_id]
```

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/pytest tests/test_store.py -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/martyrology_api/store.py tests/test_store.py tests/fixtures/editions_private/martyrologium_romanum_2004/footnotes.json
git commit -m "feat: load each edition's footnotes.json"
```

---

### Task 2: API: serve footnotes, redacted with the text

**Repo:** `martyrology-api`, same branch.

**Files:**
- Modify: `src/martyrology_api/models.py` (`ElogiumOut`, `EditionPlacementOut`; add `FootnoteOut`)
- Modify: `src/martyrology_api/routers/read.py` (`elogium_out`, `_day_content` and their three call sites; `get_elogium`)
- Modify: `src/martyrology_api/licensing.py` (`redact`)
- Modify: `data/editions/README.md`
- Test: `tests/test_licensing_api.py`

**Interfaces:**
- Consumes: `Store.footnotes(edition_id)` from Task 1.
- Produces: JSON field `footnotes: [{mark, after, text}]` on every eulogy of `/elogia/...` (day, month, slug) and on every placement of `/elogium/{id}`; `[]` when there are none or when the text is redacted.

- [ ] **Step 1: Write the failing tests** (append to `tests/test_licensing_api.py`, which already has the `client` fixture with `Bearer good` granted `martyrologium_romanum_2004`)

```python
FOOTNOTE = {"mark": "1", "after": "sociorum", "text": "Quorum nomina: sancti Narcissus et Marcellinus."}


def _argeus(body):
    return next(e for e in body["elogia"] if e["id"] == "mr:0102-argeus-et-socii")


def test_authorized_day_carries_footnotes(client):
    b = client.get(
        "/api/v1/elogia/edition/martyrologium_romanum_2004/01/02", headers={"Authorization": "Bearer good"}
    ).json()
    assert _argeus(b)["footnotes"] == [FOOTNOTE]
    assert all(e["footnotes"] == [] for e in b["elogia"] if e["id"] != "mr:0102-argeus-et-socii")


def test_anonymous_day_and_month_footnotes_redacted(client):
    day = client.get("/api/v1/elogia/edition/martyrologium_romanum_2004/01/02").json()
    assert day["metadata"]["access"] == "restricted-texts"
    assert _argeus(day)["footnotes"] == []
    month = client.get("/api/v1/elogia/01").json()  # the universal route resolves to the 2004 Latin
    assert all(e["footnotes"] == [] for d in month["days"].values() for e in d["elogia"])


def test_elogium_placement_footnotes_follow_access(client):
    url = "/api/v1/elogium/mr:0102-argeus-et-socii"
    authorized = client.get(url, headers={"Authorization": "Bearer good"}).json()
    assert authorized["editions"]["martyrologium_romanum_2004"]["footnotes"] == [FOOTNOTE]
    anonymous = client.get(url).json()
    assert anonymous["editions"]["martyrologium_romanum_2004"]["footnotes"] == []


def test_public_edition_without_footnotes_has_empty_lists(client):
    b = client.get("/api/v1/elogia/edition/martyrologium_romanum_1749/01/01").json()
    assert all(e["footnotes"] == [] for e in b["elogia"])
```

- [ ] **Step 2: Run them to see them fail**

Run: `.venv/bin/pytest tests/test_licensing_api.py -q -k footnote`
Expected: FAIL with `KeyError: 'footnotes'`.

- [ ] **Step 3: Models** (`models.py`, above `ElogiumOut`; add `Field` to the pydantic import if missing)

```python
class FootnoteOut(BaseModel):
    """A footnote as printed under a eulogy: its printed mark, the phrase the
    mark follows in the text (null when it couldn't be anchored), its text."""

    mark: str
    after: str | None
    text: str
```

Add to both `ElogiumOut` and `EditionPlacementOut`, as the last field:

```python
    footnotes: list[FootnoteOut] = Field(default_factory=list)
```

- [ ] **Step 4: Responses** (`routers/read.py`; import `FootnoteOut` with the other models)

```python
def elogium_out(e: Elogium, footnotes: dict[str, list[dict]] | None = None) -> ElogiumOut:
    return ElogiumOut(
        id=e.id,
        entry=e.entry,
        asterisk=e.asterisk,
        unnumbered=e.unnumbered,
        anchor_day=f"{e.anchor_month:02d}-{e.anchor_day:02d}",
        text=e.text,
        footnotes=[FootnoteOut(**f) for f in (footnotes or {}).get(e.id or "", [])],
    )


def _day_content(d: DayData, footnotes: dict[str, list[dict]] | None = None) -> DayContentOut:
    return DayContentOut(
        titulus=d.titulus,
        elogia=[elogium_out(e, footnotes) for e in d.elogia],
        conclusio=d.conclusio,
    )
```

At the three call sites in the day/month/slug handler, `store` is `request.app.state.store` and the edition is `resolution.edition_id`:

```python
    notes = store.footnotes(resolution.edition_id)
    # month:  _day_content(v, notes)
    # day:    _day_content(day_data, notes)
    # slug:   elogium_out(hit, notes)
```

In `get_elogium`, inside the placements loop:

```python
        notes = store.footnotes(p.edition_id).get(canonical_id, []) if allowed else []
        placements[p.edition_id] = EditionPlacementOut(
            day_printed=p.day_printed,
            entry=p.entry,
            asterisk=p.asterisk,
            unnumbered=p.unnumbered,
            text=text,
            footnotes=[FootnoteOut(**f) for f in notes],
        )
```

- [ ] **Step 5: Redaction** (`licensing.py`)

```python
def redact(elogia: list[ElogiumOut]) -> None:
    for e in elogia:
        e.text = None
        e.footnotes = []
```

- [ ] **Step 6: Run the whole suite and the linters**

Run: `.venv/bin/pytest -q && .venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright`
Expected: all pass (the OpenAPI validity test covers the new schema).

- [ ] **Step 7: Document the file** (`data/editions/README.md`, a new section after "Source")

```markdown
## Footnotes

An edition folder may carry a `footnotes.json`: the footnotes the print sets under its eulogies, by canonical ID, in printed order:

    {
      "mr:0115-ioannes-baptista-triquerie-et-socii": [
        { "mark": "1", "after": "sociorum,", "text": "Quorum nomina: …" }
      ]
    }

`mark` is the printed mark as a string (the 2004 Latin numbers its notes from 1 each month; the 1914 English uses asterisks). `after` is the phrase the mark follows, which occurs exactly once in the eulogy's text as whole words, or null when it couldn't be anchored (readers then set the mark at the end of the eulogy). The API returns them as each eulogy's `footnotes`, emptied wherever the text is redacted.
```

- [ ] **Step 8: Commit**

```bash
git add src tests data/editions/README.md
git commit -m "feat: serve each eulogy's printed footnotes, redacted with its text"
```

---

### Task 3: Frontend: footnote types and placement helpers

**Repo:** `martyrology-frontend`, branch `feat/original-footnotes` from `main`.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/misprints.ts`
- Create: `lib/footnotes.ts`
- Test: `lib/__tests__/footnotes.test.ts`

**Interfaces:**
- Consumes: the API field from Task 2.
- Produces:
  - `interface Footnote { mark: string; after: string | null; text: string }` (`lib/types.ts`); `footnotes?: Footnote[]` on `ElogiumOut` and `EditionPlacement`.
  - `wholeWordRegExp(phrase: string): RegExp` (`lib/misprints.ts`, global, Unicode).
  - `interface PageFootnote extends Footnote { id: string; at: number; anchor: string; markAnchor: string }`.
  - `pageFootnotes(elogia: (Pick<ElogiumOut, "id" | "footnotes"> | null)[], edition: string): PageFootnote[]`
  - `footnoteOffsets(text: string, footnotes: PageFootnote[]): { at: number; footnote: PageFootnote }[]`

- [ ] **Step 1: Write the failing tests** (`lib/__tests__/footnotes.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { footnoteOffsets, pageFootnotes } from "@/lib/footnotes";

const fn = (mark: string, after: string | null, text = `Note ${mark}.`) => ({ mark, after, text });

describe("pageFootnotes", () => {
  it("lists a page's printed footnotes in printed order, with their printed marks", () => {
    const notes = pageFootnotes(
      [
        { id: "mr:a", footnotes: [fn("3", "sociorum,")] },
        null,
        { id: "mr:b", footnotes: [] },
        { id: "mr:c", footnotes: [fn("4", "martyrum"), fn("5", "virginum")] },
      ],
      "ed",
    );
    expect(notes.map((n) => [n.id, n.mark, n.at])).toEqual([["mr:a", "3", 0], ["mr:c", "4", 3], ["mr:c", "5", 3]]);
    expect(notes[0]).toMatchObject({ anchor: "fn-ed-mr:a-1", markAnchor: "fn-ed-mr:a-1-mark" });
  });

  it("lists a eulogy printed twice on the page once, at its first printing", () => {
    const e = { id: "mr:a", footnotes: [fn("1", "x")] };
    expect(pageFootnotes([e, e], "ed").map((n) => n.at)).toEqual([0]);
  });

  it("tolerates eulogies without the field (an older API)", () => {
    expect(pageFootnotes([{ id: "mr:a" }], "ed")).toEqual([]);
  });
});

describe("footnoteOffsets", () => {
  const text = "Tomis, sanctorum Argei et sociorum, martyrum.";
  const place = (after: string | null) => footnoteOffsets(text, pageFootnotes([{ id: "mr:a", footnotes: [fn("1", after)] }], "ed"))[0].at;

  it("sets the mark right after its phrase, as whole words", () => {
    expect(text.slice(0, place("sociorum,"))).toBe("Tomis, sanctorum Argei et sociorum,");
  });

  it("sets it at the end of the eulogy when the phrase is missing, repeated, or null", () => {
    expect(place("sociarum")).toBe(text.length);
    expect(place("orum")).toBe(text.length); // only part of a word
    expect(footnoteOffsets("et et.", pageFootnotes([{ id: "mr:a", footnotes: [fn("1", "et")] }], "ed"))[0].at).toBe(6);
    expect(place(null)).toBe(text.length);
  });

  it("orders marks by position, keeping printed order at the same position", () => {
    const notes = pageFootnotes([{ id: "mr:a", footnotes: [fn("2", null), fn("1", "Argei"), fn("3", null)] }], "ed");
    expect(footnoteOffsets(text, notes).map((m) => m.footnote.mark)).toEqual(["1", "2", "3"]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/__tests__/footnotes.test.ts`
Expected: FAIL, cannot resolve `@/lib/footnotes`.

- [ ] **Step 3: Types** (`lib/types.ts`)

```ts
/** A footnote as the edition prints it under a eulogy (the API's `footnotes.json`). */
export interface Footnote {
  /** The printed mark: "1", "12", "*". */
  mark: string;
  /** The phrase the mark follows in the text; null when it couldn't be anchored. */
  after: string | null;
  text: string;
}
```

Add `footnotes?: Footnote[];` as the last field of `ElogiumOut` and of `EditionPlacement`.

- [ ] **Step 4: Share the whole-word rule** (`lib/misprints.ts`: replace the inline `new RegExp(...)` in `splitMisprints` with a call to this)

```ts
/** `phrase` as whole words: not inside a longer word on either side. */
export function wholeWordRegExp(phrase: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{M}\\p{N}])`, "gu");
}
```

and in `splitMisprints`: `const re = wholeWordRegExp(m.printed);`

- [ ] **Step 5: Implement** (`lib/footnotes.ts`)

```ts
import { wholeWordRegExp } from "@/lib/misprints";
import type { ElogiumOut, Footnote } from "@/lib/types";

/** A printed footnote placed on a page. */
export interface PageFootnote extends Footnote {
  id: string;
  /** Where its eulogy first comes in the page's list: only that printing carries the mark. */
  at: number;
  /** The footnote's element id. */
  anchor: string;
  /** The element id of its mark in the text, for the link back. */
  markAnchor: string;
}

/**
 * The printed footnotes of a page's eulogies, in printed order, with their printed marks.
 * `edition` keeps the anchors apart when two sheets face each other.
 */
export function pageFootnotes(elogia: (Pick<ElogiumOut, "id" | "footnotes"> | null)[], edition: string): PageFootnote[] {
  const seen = new Set<string>();
  const out: PageFootnote[] = [];
  elogia.forEach((e, at) => {
    if (!e?.id || seen.has(e.id) || !e.footnotes?.length) return;
    const id = e.id;
    seen.add(id);
    e.footnotes.forEach((f, k) => {
      const anchor = `fn-${edition}-${id}-${k + 1}`;
      out.push({ ...f, id, at, anchor, markAnchor: `${anchor}-mark` });
    });
  });
  return out;
}

/**
 * Where each footnote's mark goes in `text`: right after its phrase when the phrase occurs exactly
 * once as whole words, otherwise at the end of the eulogy. Sorted by position, printed order kept.
 */
export function footnoteOffsets(text: string, footnotes: PageFootnote[]): { at: number; footnote: PageFootnote }[] {
  return footnotes
    .map((footnote, i) => {
      const hits = footnote.after ? [...text.matchAll(wholeWordRegExp(footnote.after))] : [];
      const at = hits.length === 1 ? hits[0].index! + footnote.after!.length : text.length;
      return { at, footnote, i };
    })
    .sort((x, y) => x.at - y.at || x.i - y.i)
    .map(({ at, footnote }) => ({ at, footnote }));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run lib/__tests__/footnotes.test.ts lib/__tests__/misprints.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/misprints.ts lib/footnotes.ts lib/__tests__/footnotes.test.ts
git commit -m "feat: place printed footnotes after their anchor phrase"
```

---

### Task 4: Frontend: show printed footnotes on the page and in the spread

**Repo:** `martyrology-frontend`, same branch.

**Files:**
- Create: `components/PrintedFootnotes.tsx`
- Modify: `components/EulogyText.tsx`, `components/Eulogy.tsx`, `components/DayPage.tsx`, `components/Spread.tsx`, `components/page.module.css`
- Test: `components/__tests__/DayPage.test.tsx`, `components/__tests__/Spread.test.tsx`

**Interfaces:**
- Consumes: `PageFootnote`, `pageFootnotes`, `footnoteOffsets` (Task 3).
- Produces: `FootnoteMark({ note }: { note: PageFootnote })`; default `PrintedFootnotes({ notes, lang }: { notes: PageFootnote[]; lang?: string })`, rendering `<aside aria-label="Footnotes">`; `Eulogy` and `EulogyText` gain `footnotes?: PageFootnote[]`.

- [ ] **Step 1: Write the failing tests** (append to `components/__tests__/DayPage.test.tsx`)

```tsx
describe("DayPage, printed footnotes", () => {
  const withNotes = {
    ...day,
    elogia: [
      { ...day.elogia[1], footnotes: [{ mark: "3", after: "Modesti", text: "Quorum nomina: Crescentia." }] },
      { ...day.elogia[2], footnotes: [{ mark: "4", after: "nusquam", text: "Inter quos: Vitus." }] },
    ],
  };

  it("shows them without the ids, marks as printed, linked both ways", () => {
    render(<DayPage day={withNotes} heading="2 Octobris" edition="ed" lang="la" />);
    const three = screen.getByRole("link", { name: "Footnote 3" });
    expect(three).toHaveTextContent(/^3$/);
    expect(three.closest("p")).toHaveTextContent("Romae passio sancti Modesti3 Sardi.");
    const list = screen.getByRole("complementary", { name: "Footnotes" });
    expect(list).toHaveAttribute("lang", "la");
    const items = list.querySelectorAll("li");
    expect(three).toHaveAttribute("href", `#${items[0].id}`);
    expect(items[0]).toHaveTextContent(/^3Quorum nomina: Crescentia\.$/);
    expect(screen.getByRole("link", { name: "Back to the text of footnote 3" })).toHaveAttribute("href", `#${three.id}`);
  });

  it("sets an unanchored mark at the end of the eulogy", () => {
    render(<DayPage day={withNotes} heading="2 Octobris" edition="ed" />);
    expect(screen.getByRole("link", { name: "Footnote 4" }).closest("p")).toHaveTextContent("Alibi sancti X.4");
  });

  it("lists printed footnotes before the curators' notes", () => {
    const both = { ...withNotes, elogia: [...withNotes.elogia, { id: "mr:0104-ferreolus", entry: 4, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Sancti Ferreoli." }] };
    render(<DayPage day={both} heading="2 Octobris" edition="ed" showIds />);
    const asides = screen.getAllByRole("complementary").map((a) => a.getAttribute("aria-label"));
    expect(asides).toEqual(["Footnotes", "Editorial notes"]);
  });

  it("puts the mark right after a misprinted word, before the sic note", () => {
    const sic = { ...day, elogia: [{ id: "mr:0305-phoca", entry: 1, asterisk: false, unnumbered: false, anchor_day: "03-05", text: "Commemorazione nell’odiena memoria.", footnotes: [{ mark: "1", after: "nell’odiena", text: "Nota." }] }] };
    render(<DayPage day={sic} heading="5 marzo" edition="martyrologium_romanum_2004_it_IT" />);
    expect(screen.getByRole("link", { name: "Footnote 1" }).closest("p")).toHaveTextContent(/nell’odiena1 \[sic! expected: nell’odierna\] memoria\./);
  });

  it("renders a page without the field exactly as before", () => {
    const { container } = render(<DayPage day={day} heading="2 Octobris" edition="ed" />);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
```

The misprint test relies on the real `mr:0305-phoca` entry in `data/misprints-snapshot.json` (printed "nell’odiena", intended "nell’odierna"); if that entry changes, pick another from the snapshot.

Append to `components/__tests__/Spread.test.tsx`, inside `describe("Spread", …)`:

```tsx
  it("sets each sheet's printed footnotes on that sheet only", async () => {
    const withFn = (e: ElogiumOut, mark: string) => ({ ...e, footnotes: [{ mark, after: null, text: `Nota ${mark}.` }] });
    serve({
      [A]: day(A, [withFn(el("mr:x", 1, "Romae sancti X."), "1")]),
      [B]: day(B, [el("mr:x", 4, "Romae passio sancti X.")]),
    });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    await screen.findByText(/Romae sancti X\./);
    const lists = screen.getAllByRole("complementary", { name: "Footnotes" });
    expect(lists.map((l) => l.closest("[data-side]")!.getAttribute("data-side"))).toEqual(["a"]);
    expect(screen.getByRole("link", { name: "Footnote 1" })).toHaveAttribute("href", `#fn-${A}-mr:x-1`);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/__tests__/DayPage.test.tsx components/__tests__/Spread.test.tsx`
Expected: FAIL, no "Footnote 3" link.

- [ ] **Step 3: The component** (`components/PrintedFootnotes.tsx`)

```tsx
import styles from "@/components/page.module.css";
import type { PageFootnote } from "@/lib/footnotes";

/** A printed footnote's mark in the text, as printed and in the text's colour, linked to the footnote. */
export function FootnoteMark({ note }: { note: PageFootnote }) {
  return (
    <a id={note.markAnchor} href={`#${note.anchor}`} className={styles.fnMark} aria-label={`Footnote ${note.mark}`}>
      {note.mark}
    </a>
  );
}

/** The edition's own footnotes at the foot of the page, each linked back to its mark. */
export default function PrintedFootnotes({ notes, lang }: { notes: PageFootnote[]; lang?: string }) {
  if (notes.length === 0) return null;
  return (
    <aside className={styles.footnotes} lang={lang} aria-label="Footnotes">
      <ul>
        {notes.map((n) => (
          <li key={n.anchor} id={n.anchor}>
            <a href={`#${n.markAnchor}`} className={styles.fnMark} aria-label={`Back to the text of footnote ${n.mark}`}>
              {n.mark}
            </a>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 4: Marks in the text** (`components/EulogyText.tsx`, the whole file)

```tsx
import { Fragment, type ReactNode } from "react";
import { FootnoteMark } from "@/components/PrintedFootnotes";
import { footnoteOffsets, type PageFootnote } from "@/lib/footnotes";
import { misprintsFor, splitMisprints } from "@/lib/misprints";

/**
 * A eulogy's text as printed in `edition`, with `[sic! expected: …]` after each verified misprint
 * (set upright with *sic!* in italics, as in critical editions) and each printed footnote's mark after
 * its phrase. `noteClassName` sets the misprint note's size and colour.
 */
export default function EulogyText({
  text, id, edition, noteClassName = "text-[0.8em] text-slate-600 dark:text-slate-300", footnotes = [],
}: {
  text: string; id: string | null; edition: string; noteClassName?: string; footnotes?: PageFootnote[];
}) {
  const misprints = misprintsFor(edition, id);
  if (misprints.length === 0 && footnotes.length === 0) return <>{text}</>;
  const marks = footnoteOffsets(text, footnotes);
  let pos = 0;
  return (
    <>
      {splitMisprints(text, misprints).map((s, i) => {
        const start = pos;
        pos += s.text.length;
        const parts: ReactNode[] = [];
        let cut = 0;
        for (const m of marks.filter((m) => m.at > start && m.at <= pos)) {
          parts.push(<Fragment key={`t${m.footnote.anchor}`}>{s.text.slice(cut, m.at - start)}</Fragment>);
          parts.push(<FootnoteMark key={m.footnote.anchor} note={m.footnote} />);
          cut = m.at - start;
        }
        parts.push(<Fragment key="rest">{s.text.slice(cut)}</Fragment>);
        return (
          <Fragment key={i}>
            {parts}
            {s.intended && (
              <span className={noteClassName} style={{ fontStyle: "normal" }}>
                {" "}[<i>sic!</i> expected: {s.intended}]
              </span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Thread it through `Eulogy`** (`components/Eulogy.tsx`)

Add the prop and pass it on; render through `EulogyText` whenever there is text, so marks work even without an edition id:

```tsx
import type { PageFootnote } from "@/lib/footnotes";
// props: { e, edition, showId = false, note, footnotes }: { …; footnotes?: PageFootnote[] }
  const printed = e.text ? (
    <EulogyText text={e.text} id={e.id} edition={edition ?? ""} noteClassName={styles.sic} footnotes={footnotes} />
  ) : (
    e.text
  );
```

(`misprintsFor("", id)` matches no misprint, so pages rendered without an edition behave as before.)

- [ ] **Step 6: The page** (`components/DayPage.tsx`)

```tsx
import PrintedFootnotes from "@/components/PrintedFootnotes";
import { pageFootnotes, type PageFootnote } from "@/lib/footnotes";
// in the component, beside `notes` / `noteAt`:
  const footnotes = pageFootnotes(day.elogia, edition ?? "");
  const footAt = new Map<number, PageFootnote[]>();
  for (const f of footnotes) footAt.set(f.at, [...(footAt.get(f.at) ?? []), f]);
// each eulogy:
        <Eulogy key={e.id ?? i} e={e} edition={edition} showId={showIds} note={noteAt.get(i)} footnotes={footAt.get(i)} />
// after the conclusio, before <CuratorNotes …/>:
      <PrintedFootnotes notes={footnotes} lang={lang} />
```

- [ ] **Step 7: The spread** (`components/Spread.tsx`)

Extend the `notes` memo to compute both kinds per side:

```tsx
  const notes = useMemo(() => {
    const ids = (s: "a" | "b") => (rows ?? []).map((r) => (r.kind === "eulogy" ? (r[s] ?? null) : null));
    const side = (s: "a" | "b", id: string) => ({
      curators: showIds ? pageNotes(ids(s).map((e) => e?.id ?? null), id) : [],
      printed: pageFootnotes(ids(s), id),
    });
    return { a: side("a", a), b: side("b", b) };
  }, [rows, showIds, a, b]);
```

In the closing row:

```tsx
    if (r.kind === "conclusio") {
      const n = notes[side];
      if (!d.conclusio && n.curators.length === 0 && n.printed.length === 0) return null;
      return (
        <>
          {d.conclusio && <Conclusio text={d.conclusio} />}
          <PrintedFootnotes notes={n.printed} lang={s.lang} />
          <CuratorNotes notes={n.curators} />
        </>
      );
    }
```

And for each eulogy cell:

```tsx
          <Eulogy
            e={e}
            edition={s.id}
            showId={showIds}
            note={notes[side].curators.find((n) => n.at === i)}
            footnotes={notes[side].printed.filter((f) => f.at === i)}
          />
```

Import `PrintedFootnotes` and `pageFootnotes`.

- [ ] **Step 8: Styles** (`components/page.module.css`, after the curators' notes rules)

```css
/* The edition's own footnotes: marks as printed, in the text's colour; listed above the curators' notes. */
.fnMark {
  color: inherit; font-size: 0.7em; line-height: 0; vertical-align: super; margin-left: 0.05em;
  text-decoration: none; font-style: normal; scroll-margin-top: 6rem;
}
.fnMark:hover, .fnMark:focus-visible { text-decoration: underline; }
.footnotes { margin-top: 1.5rem; font-size: 0.8rem; line-height: 1.45; }
.footnotes::before { content: ""; display: block; width: 5rem; margin-bottom: 0.6rem; border-top: 1px solid rgba(120, 80, 40, 0.35); }
.footnotes li { display: grid; grid-template-columns: 2.2em 1fr; margin: 0.35rem 0; scroll-margin-top: 6rem; border-radius: 3px; }
.footnotes li .fnMark { font-size: 1em; vertical-align: baseline; line-height: inherit; margin: 0; text-align: right; padding-right: 0.5em; }
.footnotes li:target { background: rgba(214, 170, 60, 0.25); }
.footnotes + .notes { margin-top: 0.75rem; }
```

- [ ] **Step 9: Run everything**

Run: `npx vitest run && npx eslint . && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add components lib
git commit -m "feat: show the editions' printed footnotes, marks as printed, above the curators' notes"
```

---

### Task 5: Texts: scan the Latin PDF's layout for marks and footnotes

**Repo:** `martyrology-texts`, branch `feat/original-footnotes` from `main`. Tests run with the system `python3` (PyMuPDF 1.28 and pytest 9 are installed): `python3 -m pytest tests -q`.

**Files:**
- Create: `scripts/extract_footnotes.py` (this task: data types, `merge_rows`, `scan`, `pair`)
- Create: `tests/conftest.py`, `tests/test_extract_footnotes.py`

**Interfaces:**
- Produces:
  - `Span(text: str, size: float)`, `Line(page: int, y: float, x: float, spans: list[Span])` with properties `.text` (spans joined, whitespace collapsed, stripped) and `.size` (largest span).
  - `Marker(mark: str, month: int, day: int, entry: int, before: str, page: int)`, `Note(mark: str, page: int, text: str)`.
  - `merge_rows(lines: list[Line]) -> list[Line]`: lines of one page at the same height joined left to right, in reading order.
  - `scan(lines: list[Line]) -> tuple[list[Marker], list[Note], list[str]]` (markers, notes, problems).
  - `pair(markers: list[Marker], notes: list[Note]) -> tuple[list[tuple[Marker, Note]], list[str]]`.

Facts this rests on (measured on `Martyrologium Romanum (2004).pdf`, 2026-10-03): body spans are about 11 pt; a day heading is a line "Die 2 ianuarii" at about 14.5 pt; an entry starts with a separate span "6. " or "7*. " (or "11 " then "*. ") at the left margin, on the same height as its first words; a day's first eulogy opens with a drop cap and no number; an in-text mark is a span of digits at about 7.4 pt; a footnote line starts with a span of digits at about 5.7 pt, then text at about 8.2 pt; running heads and page numbers sit above 6% of the page height; the calendar runs from p. 79 ("Die 1 ianuarii") to p. 697 (the index starts after).

- [ ] **Step 1: Test scaffolding** (`tests/conftest.py`)

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
```

- [ ] **Step 2: Write the failing tests** (`tests/test_extract_footnotes.py`; all text invented)

```python
from extract_footnotes import Line, Marker, Note, Span, merge_rows, pair, scan


def line(page, y, *spans, x=52.0):
    return Line(page, y, x, [Span(t, s) for t, s in spans])


def test_merge_rows_joins_an_entry_number_to_its_line():
    rows = merge_rows([line(1, 0.200, ("Romae ", 11.2), x=80.0), line(1, 0.2005, ("6. ", 11.0), x=52.0)])
    assert [r.text for r in rows] == ["6. Romae"]


def test_scan_finds_marks_with_their_day_entry_and_preceding_words():
    lines = [
        line(1, 0.03, ("110 ", 10.3)),  # page number: ignored
        line(1, 0.20, ("Die 2 ianuarii", 14.5)),
        line(1, 0.25, ("Romae sancti Felicis, cum ", 11.2), ("sociis, ", 11.1), ("1 ", 7.4), ("martyrum.", 11.0)),
        line(1, 0.30, ("6. ", 11.0), ("Alibi sanctorum ", 11.2), ("2 ", 7.3), ("virginum.", 11.1)),
        line(1, 0.85, ("1 ", 5.7), ("Quorum nomina: Petrus,", 8.2)),
        line(1, 0.87, ("Paulus et Ioan-", 8.2)),
        line(1, 0.89, ("nes.", 8.3)),
        line(1, 0.91, ("2 ", 5.7), ("Inter quos: Maria.", 8.2)),
    ]
    markers, notes, problems = scan(merge_rows(lines))
    assert problems == []
    assert [(m.mark, m.month, m.day, m.entry) for m in markers] == [("1", 1, 2, 1), ("2", 1, 2, 6)]
    assert markers[0].before.endswith("cum sociis,")
    assert [(n.mark, n.text) for n in notes] == [("1", "Quorum nomina: Petrus, Paulus et Ioannes."), ("2", "Inter quos: Maria.")]


def test_scan_reads_an_asterisked_entry_number_split_across_spans():
    lines = [line(1, 0.2, ("Die 3 martii", 14.5)), line(1, 0.3, ("11 ", 11.0), ("*. ", 14.7), ("Alibi ", 11.0), ("1 ", 7.4), ("sancti.", 11.2))]
    markers, _, _ = scan(merge_rows(lines))
    assert [(m.month, m.day, m.entry) for m in markers] == [(3, 3, 11)]


def test_scan_ignores_the_lunar_table_digits():
    lines = [line(1, 0.2, ("Die 1 ianuarii", 14.6)), line(1, 0.35, ("21", 11.4)), line(1, 0.36, ("22", 11.8))]
    markers, notes, problems = scan(merge_rows(lines))
    assert (markers, notes, problems) == ([], [], [])


def test_scan_keeps_a_eulogy_running_over_to_the_next_page():
    lines = [
        line(1, 0.2, ("Die 4 maii", 14.5)),
        line(1, 0.8, ("7. ", 11.0), ("In Hispania sanctorum", 11.2)),
        line(2, 0.1, ("sociorum ", 11.2), ("1 ", 7.4), ("martyrum.", 11.0)),
    ]
    markers, _, _ = scan(merge_rows(lines))
    assert [(m.page, m.entry) for m in markers] == [(2, 7)]
    assert markers[0].before.endswith("sanctorum sociorum")


def test_scan_reports_footnote_text_before_any_number():
    lines = [line(1, 0.9, ("orphan text", 8.2))]
    _, notes, problems = scan(merge_rows(lines))
    assert notes == [] and len(problems) == 1


def test_pair_matches_by_mark_on_the_same_or_the_next_page():
    m1 = Marker("1", 1, 2, 1, "x", page=10)
    m2 = Marker("2", 1, 2, 6, "y", page=10)
    n1 = Note("1", 10, "A.")
    n2 = Note("2", 11, "B.")  # set on the following page
    pairs, problems = pair([m1, m2], [n1, n2])
    assert [(m.mark, n.text) for m, n in pairs] == [("1", "A."), ("2", "B.")]
    assert problems == []


def test_pair_reports_marks_and_notes_left_over():
    pairs, problems = pair([Marker("3", 1, 5, 2, "x", page=10)], [Note("4", 10, "D.")])
    assert pairs == [] and len(problems) == 2
```

- [ ] **Step 3: Run them to see them fail**

Run: `python3 -m pytest tests -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'extract_footnotes'`.

- [ ] **Step 4: Implement** (`scripts/extract_footnotes.py`)

```python
#!/usr/bin/env python3
"""Extract the footnotes of the Latin editio typica altera 2004 from its PDF into
data/editions/martyrologium_romanum_2004/footnotes.json, keyed by CRMEDR id.

THIS DATA IS COPYRIGHTED (© Dicastery for Divine Worship and the Discipline of
the Sacraments) and lives in a PRIVATE repository. Never publish it, the PDF,
or crops of it.

The PDF is a scan with an OCR layer: footnotes, their marks and the day and
entry they belong to are found by layout (font size and position), then the
hand-kept footnotes-overrides.json is applied last, so a rerun never undoes
proofreading.

Usage:
  python3 scripts/extract_footnotes.py "/path/to/Martyrologium Romanum (2004).pdf" \
      [--crmedr ../crmedr] [--crops footnote-crops]
"""

import re
from dataclasses import dataclass, field

EDITION = "martyrologium_romanum_2004"
CALENDAR_PAGES = (79, 697)  # 1-based, inclusive: "Die 1 ianuarii" to the page before the index
MONTH_PREFIX = {
    "ian": 1, "feb": 2, "mar": 3, "apr": 4, "mai": 5, "iun": 6,
    "iul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
HEAD_MIN = 13.0  # day headings at about 14.5 pt
FOOT_MAX = 9.6  # footnote lines at about 8.2 pt, body at about 11
MARK_RATIO = 0.8  # an in-text mark (about 7.4 pt) against its line's median span
TOP_MARGIN = 0.06  # running heads and page numbers
ROW_TOLERANCE = 0.004  # spans this close in height share a row

DAY_HEAD = re.compile(r"^Die\s+(\d{1,2})\s+([A-Za-z]+)")
ENTRY = re.compile(r"^(\d{1,2})\s*\*?\s*\.(\s|$)")
FOOT_START = re.compile(r"^(\d{1,3})\s+(\S.*)$")


@dataclass
class Span:
    text: str
    size: float


@dataclass
class Line:
    page: int
    y: float  # top of the line, as a fraction of the page height
    x: float
    spans: list[Span] = field(default_factory=list)

    @property
    def text(self) -> str:
        return re.sub(r"\s+", " ", "".join(s.text for s in self.spans)).strip()

    @property
    def size(self) -> float:
        return max((s.size for s in self.spans), default=0.0)


@dataclass
class Marker:
    mark: str
    month: int
    day: int
    entry: int
    before: str  # the eulogy's words up to the mark, as the OCR reads them
    page: int


@dataclass
class Note:
    mark: str
    page: int
    text: str


def join(a: str, b: str) -> str:
    """Join two runs of OCR text, mending a word hyphenated at the line end."""
    a, b = a.rstrip(), b.strip()
    if not a:
        return b
    if a.endswith("-") and b[:1].islower():
        return a[:-1] + b
    return f"{a} {b}"


def merge_rows(lines: list[Line]) -> list[Line]:
    """One line per printed row: spans at the same height on a page, left to right."""
    out: list[Line] = []
    for ln in sorted(lines, key=lambda l: (l.page, l.y, l.x)):
        last = out[-1] if out else None
        if last and last.page == ln.page and abs(last.y - ln.y) <= ROW_TOLERANCE:
            pieces = sorted([(last.x, last.spans), (ln.x, ln.spans)], key=lambda p: p[0])
            last.x = pieces[0][0]
            last.spans = pieces[0][1] + pieces[1][1]
        else:
            out.append(Line(ln.page, ln.y, ln.x, list(ln.spans)))
    return out


def _median(xs: list[float]) -> float:
    s = sorted(xs)
    return s[len(s) // 2] if s else 0.0


def scan(lines: list[Line]) -> tuple[list[Marker], list[Note], list[str]]:
    markers: list[Marker] = []
    notes: list[Note] = []
    problems: list[str] = []
    month = day = entry = None
    before = ""
    for ln in lines:
        t = ln.text
        if not t or ln.y < TOP_MARGIN:
            continue
        if ln.size < FOOT_MAX and ln.y > 0.5:
            m = FOOT_START.match(t)
            if m:
                notes.append(Note(m.group(1), ln.page, m.group(2)))
            elif notes:
                notes[-1].text = join(notes[-1].text, t)
            else:
                problems.append(f"p. {ln.page}: footnote text with no number: {t[:60]}")
            continue
        h = DAY_HEAD.match(t)
        if h and ln.size >= HEAD_MIN:
            mo = MONTH_PREFIX.get(h.group(2)[:3].lower())
            if mo is None:
                problems.append(f"p. {ln.page}: unreadable month in heading: {t[:60]}")
                continue
            month, day, entry, before = mo, int(h.group(1)), 1, ""
            continue
        spans = ln.spans
        e = ENTRY.match(t)
        if e and month is not None:
            entry, before = int(e.group(1)), ""
            # the number (and its asterisk) are not words of the eulogy
            numbered = re.match(r"^\s*\d{1,2}\s*\*?\s*\.?\s*$", spans[0].text)
            spans = spans[1:] if numbered else spans
            if spans and re.fullmatch(r"\s*\*?\s*\.\s*", spans[0].text):
                spans = spans[1:]
        ref = _median([s.size for s in spans if not s.text.strip().isdigit()]) or ln.size
        for s in spans:
            st = s.text.strip()
            if st.isdigit() and s.size < MARK_RATIO * ref:
                if month is None or day is None or entry is None:
                    problems.append(f"p. {ln.page}: mark {st} before any day heading")
                    continue
                markers.append(Marker(st, month, day, entry, before, ln.page))
            else:
                before = join(before, s.text)
    return markers, notes, problems


def pair(markers: list[Marker], notes: list[Note]) -> tuple[list[tuple[Marker, Note]], list[str]]:
    """Each mark with the footnote of the same mark on its page, or failing that on the next."""
    free = list(notes)
    pairs: list[tuple[Marker, Note]] = []
    problems: list[str] = []
    for m in markers:
        hit = next((n for n in free if n.mark == m.mark and n.page == m.page), None) or next(
            (n for n in free if n.mark == m.mark and n.page == m.page + 1), None
        )
        if hit is None:
            problems.append(f"p. {m.page}: mark {m.mark} ({m.month:02d}-{m.day:02d} n. {m.entry}) has no footnote")
            continue
        free.remove(hit)
        pairs.append((m, hit))
    problems += [f"p. {n.page}: footnote {n.mark} has no mark in the text: {n.text[:60]}" for n in free]
    return pairs, problems
```

- [ ] **Step 5: Run the tests**

Run: `python3 -m pytest tests -q`
Expected: all pass. If `test_scan_reads_an_asterisked_entry_number_split_across_spans` fails on the "*. " span, check the two `spans = …` trims in `scan`.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract_footnotes.py tests/conftest.py tests/test_extract_footnotes.py
git commit -m "feat: scan the 2004 Latin PDF's layout for footnotes and their marks"
```

---

### Task 6: Texts: canonical ids, anchor phrases and overrides

**Repo:** `martyrology-texts`, same branch.

**Files:**
- Modify: `scripts/extract_footnotes.py`
- Test: `tests/test_extract_footnotes.py`

**Interfaces:**
- Consumes: `Marker`, `Note`, `pair` output (Task 5).
- Produces:
  - `ids_by_entry(entries: list[dict], edition: str = EDITION) -> dict[tuple[int, int, int], str]`: current registry ids printed by the edition, by (month, day, entry).
  - `whole_word_count(text: str, phrase: str) -> int`: the reader's whole-word rule (no letter, mark or digit on either side).
  - `anchor_phrase(stored: str, before: str) -> str | None`.
  - `build(pairs, ids, texts) -> tuple[dict[str, list[dict]], list[str]]`.
  - `apply_overrides(out: dict[str, list[dict]], overrides: dict) -> dict[str, list[dict]]`.

- [ ] **Step 1: Write the failing tests** (append; invented text)

```python
from extract_footnotes import anchor_phrase, apply_overrides, build, ids_by_entry, whole_word_count


def test_ids_by_entry_skips_deprecated_and_eulogies_the_edition_lacks():
    entries = [
        {"id": "mr:0825-a", "month": 8, "day": 25, "entry": 3},
        {"id": "mr:0825-b", "month": 8, "day": 25, "entry": 3, "editions": {"martyrologium_romanum_2004": {"absent": True}}},
        {"id": "mr:0825-c", "month": 8, "day": 25, "entry": 4, "deprecated": True},
    ]
    assert ids_by_entry(entries) == {(8, 25, 3): "mr:0825-a"}


def test_whole_word_count_follows_the_readers_rule():
    assert whole_word_count("et sociorum, et socii", "sociorum,") == 1
    assert whole_word_count("consociorum", "sociorum") == 0
    assert whole_word_count("et et", "et") == 2


def test_anchor_phrase_finds_the_word_despite_ocr_errors():
    stored = "Turonibus, beati Ioannis Baptistæ et tredecim sociórum, martyrum, qui pro fide occisi sunt."
    assert anchor_phrase(stored, "Turonibus, beati loannis Baptistre et tredecim soci6rum,") == "sociórum,"


def test_anchor_phrase_widens_until_the_phrase_is_unique():
    stored = "Romae sancti Felicis et sociorum; Alibi sancti Petri et sociorum, martyrum."
    assert anchor_phrase(stored, "Alibi sancti Petri et soci6rum,") == "et sociorum,"


def test_anchor_phrase_gives_up_on_a_poor_match():
    assert anchor_phrase("Romae sancti Felicis.", "omnino aliud verbum") is None


def test_build_maps_ids_and_reports_the_unplaceable():
    m1 = Marker("1", 1, 2, 1, "Romae cum soci6rum,", page=10)
    m2 = Marker("2", 1, 2, 9, "x", page=10)
    pairs = [(m1, Note("1", 10, "Quorum nomina: A.")), (m2, Note("2", 10, "B."))]
    out, problems = build(pairs, {(1, 2, 1): "mr:0102-a"}, {"mr:0102-a": "Romae cum sociórum, martyrum."})
    assert out == {"mr:0102-a": [{"mark": "1", "after": "sociórum,", "text": "Quorum nomina: A."}]}
    assert len(problems) == 1 and "01-02 n. 9" in problems[0]


def test_apply_overrides_edits_adds_and_removes():
    out = {"mr:a": [{"mark": "1", "after": None, "text": "Quorum n6mina."}], "mr:b": [{"mark": "2", "after": "x", "text": "Bad."}]}
    overrides = {
        "mr:a": {"1": {"after": "sociorum,", "text": "Quorum nómina."}},
        "mr:b": {"2": None},
        "mr:c": {"3": {"after": "martyrum", "text": "Inter quos: C."}},
    }
    assert apply_overrides(out, overrides) == {
        "mr:a": [{"mark": "1", "after": "sociorum,", "text": "Quorum nómina."}],
        "mr:c": [{"mark": "3", "after": "martyrum", "text": "Inter quos: C."}],
    }
```

- [ ] **Step 2: Run them to see them fail**

Run: `python3 -m pytest tests -q`
Expected: FAIL with `ImportError: cannot import name 'anchor_phrase'`.

- [ ] **Step 3: Implement** (append to `scripts/extract_footnotes.py`; add `import unicodedata` and `from difflib import SequenceMatcher` to the imports)

```python
def ids_by_entry(entries: list[dict], edition: str = EDITION) -> dict[tuple[int, int, int], str]:
    out: dict[tuple[int, int, int], str] = {}
    for e in entries:
        if e.get("deprecated") or e.get("entry") is None:
            continue
        if (e.get("editions") or {}).get(edition, {}).get("absent"):
            continue
        out[(e["month"], e["day"], e["entry"])] = e["id"]
    return out


def _wordish(c: str) -> bool:
    return unicodedata.category(c)[0] in "LMN"


def whole_word_count(text: str, phrase: str) -> int:
    n, i = 0, text.find(phrase)
    while i >= 0:
        j = i + len(phrase)
        if (i == 0 or not _wordish(text[i - 1])) and (j == len(text) or not _wordish(text[j])):
            n += 1
        i = text.find(phrase, i + 1)
    return n


OCR_DIGITS = str.maketrans({"6": "o", "0": "o", "1": "i"})


def _fold(w: str) -> str:
    w = unicodedata.normalize("NFKD", w)
    w = "".join(c for c in w if not unicodedata.combining(c)).lower()
    w = w.replace("æ", "ae").replace("œ", "oe")
    return re.sub(r"[^a-z]", "", w)


def _fold_ocr(w: str) -> str:
    # the scan's OCR reads ó as 6, æ as "re" and œ as "ce"
    return _fold(w.translate(OCR_DIGITS)).replace("re", "ae").replace("ce", "oe")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def anchor_phrase(stored: str, before: str) -> str | None:
    """The phrase of `stored` the mark follows: the word best matching the OCR's last words before
    the mark, widened leftwards until it occurs exactly once as whole words."""
    words = stored.split()
    ocr = [_fold_ocr(w) for w in before.split()][-3:]
    if not words or not ocr:
        return None
    best, best_i = 0.0, -1
    for i in range(len(words)):
        scores = [
            max(_similar(_fold(words[i - k]), ocr[-1 - k]), _similar(_fold(words[i - k]).replace("ae", "re"), ocr[-1 - k]))
            for k in range(len(ocr))
            if i - k >= 0
        ]
        score = sum(scores) / len(ocr)
        if score > best:
            best, best_i = score, i
    if best < 0.75:
        return None
    for n in range(1, 5):
        if best_i - n + 1 < 0:
            break
        phrase = " ".join(words[best_i - n + 1 : best_i + 1])
        if whole_word_count(stored, phrase) == 1:
            return phrase
    return None


def build(pairs, ids, texts) -> tuple[dict[str, list[dict]], list[str]]:
    out: dict[str, list[dict]] = {}
    problems: list[str] = []
    for m, n in pairs:
        where = f"{m.month:02d}-{m.day:02d} n. {m.entry} (p. {m.page}, mark {m.mark})"
        cid = ids.get((m.month, m.day, m.entry))
        if cid is None:
            problems.append(f"{where}: no registry id")
            continue
        after = anchor_phrase(texts[cid], m.before) if cid in texts else None
        if after is None:
            problems.append(f"{where} {cid}: mark not anchored, set at the end of the eulogy")
        out.setdefault(cid, []).append({"mark": m.mark, "after": after, "text": n.text})
    return out, problems


def apply_overrides(out: dict[str, list[dict]], overrides: dict) -> dict[str, list[dict]]:
    """Proofreading wins: {id: {mark: {after?, text?} | null}}. null removes a footnote; an unknown
    mark adds one."""
    result = {cid: [dict(f) for f in fs] for cid, fs in out.items()}
    for cid, by_mark in overrides.items():
        fs = result.setdefault(cid, [])
        for mark, change in by_mark.items():
            hit = next((f for f in fs if f["mark"] == mark), None)
            if change is None:
                if hit:
                    fs.remove(hit)
            elif hit:
                hit.update(change)
            else:
                fs.append({"mark": mark, "after": change.get("after"), "text": change["text"]})
    return {cid: fs for cid, fs in result.items() if fs}
```

- [ ] **Step 4: Run the tests**

Run: `python3 -m pytest tests -q`
Expected: all pass. If `test_anchor_phrase_finds_the_word_despite_ocr_errors` fails, print the per-word scores for "sociórum," and tune `_fold_ocr` (not the threshold) until the real OCR confusions fold together.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_footnotes.py tests/test_extract_footnotes.py
git commit -m "feat: map footnotes to canonical ids and anchor their marks in the stored text"
```

---

### Task 7: Texts: run on the real PDF, with a report and proofreading crops

**Repo:** `martyrology-texts`, same branch.

**Files:**
- Modify: `scripts/extract_footnotes.py` (`read_lines`, `write_crops`, `main`)
- Create: `.gitignore` (or extend it) with `footnote-crops/`
- Create: `data/editions/martyrologium_romanum_2004/footnotes-overrides.json` containing `{}`
- Generate: `data/editions/martyrologium_romanum_2004/footnotes.json`

**Interfaces:**
- Consumes: everything from Tasks 5 and 6.
- Produces: `footnotes.json` (shape of Task 1's fixture), a problems report on stdout, and with `--crops DIR` one PNG per page with footnotes (the lower part of the page at 150 dpi, gitignored, never committed).

- [ ] **Step 1: Implement the I/O** (append to `scripts/extract_footnotes.py`; add `import argparse, json, sys` and `from pathlib import Path`)

```python
def read_lines(pdf_path: str, first: int, last: int) -> list[Line]:
    import fitz

    doc = fitz.open(pdf_path)
    out: list[Line] = []
    for p in range(first - 1, last):
        page = doc[p]
        h = page.rect.height
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [Span(s["text"], s["size"]) for s in l["spans"] if s["text"].strip()]
                if spans:
                    out.append(Line(p + 1, l["bbox"][1] / h, l["bbox"][0], spans))
    return out


def write_crops(pdf_path: str, pages: set[int], dest: Path) -> None:
    import fitz

    dest.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for p in sorted(pages):
        r = doc[p - 1].rect
        clip = fitz.Rect(r.x0, r.y0 + r.height * 0.55, r.x1, r.y1)
        doc[p - 1].get_pixmap(dpi=150, clip=clip).save(dest / f"p{p:03d}.png")


def load_texts(edition_dir: Path) -> dict[str, str]:
    texts: dict[str, str] = {}
    for m in range(1, 13):
        f = edition_dir / f"{m:02d}.json"
        if f.exists():
            texts.update(json.loads(f.read_text(encoding="utf-8")))
    return texts


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--crmedr", default=str(Path(__file__).resolve().parents[2] / "crmedr"))
    ap.add_argument("--crops", help="write a PNG of each page with footnotes here, for proofreading")
    args = ap.parse_args(argv)
    root = Path(__file__).resolve().parent.parent
    edition_dir = root / "data" / "editions" / EDITION
    registry = json.loads((Path(args.crmedr) / "data" / "martyrology_ids.json").read_text(encoding="utf-8"))

    lines = merge_rows(read_lines(args.pdf, *CALENDAR_PAGES))
    markers, notes, problems = scan(lines)
    pairs, more = pair(markers, notes)
    out, unplaced = build(pairs, ids_by_entry(registry["entries"]), load_texts(edition_dir))
    overrides_file = edition_dir / "footnotes-overrides.json"
    overrides = json.loads(overrides_file.read_text(encoding="utf-8")) if overrides_file.exists() else {}
    out = apply_overrides(out, overrides)

    (edition_dir / "footnotes.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.crops:
        write_crops(args.pdf, {n.page for n in notes}, Path(args.crops))
    report = problems + more + unplaced
    total = sum(len(v) for v in out.values())
    print(f"{total} footnotes on {len(out)} eulogies; {len(markers)} marks, {len(notes)} notes; {len(report)} problems")
    for p in report:
        print("  " + p)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 2: Create the overrides file and the ignore rule**

```bash
echo '{}' > data/editions/martyrologium_romanum_2004/footnotes-overrides.json
printf '\n# Crops of the copyrighted PDF, for proofreading only\nfootnote-crops/\n' >> .gitignore
```

- [ ] **Step 3: Run on the PDF**

Run: `python3 scripts/extract_footnotes.py "/mnt/c/Users/johnr/Documents/LitCal/Roman Martyrology/Martyrologium Romanum (2004).pdf" --crops footnote-crops`

Expected: the first line reports about **66** footnotes (the survey's count) and a short list of problems. Check:
- Total footnotes within a few of 66. Many fewer: lower `MARK_RATIO` or check `FOOT_MAX` against a page in the problems list. Many more: the footnote zone is catching body text; raise the `ln.y > 0.5` bound.
- Numbering restarts each month: `python3 -c "import json;d=json.load(open('data/editions/martyrologium_romanum_2004/footnotes.json'));print([(k[3:7],f['mark']) for k,v in d.items() for f in v])"` should show marks 1, 2, 3… within each month.
- Every "no registry id" problem means a day or entry was misread: open that page's crop and fix the rule, not the data.

- [ ] **Step 4: Add a regression test with the real count** (append to `tests/test_extract_footnotes.py`; skipped where the PDF isn't available)

```python
import json
import os
from pathlib import Path

import pytest

PDF = Path("/mnt/c/Users/johnr/Documents/LitCal/Roman Martyrology/Martyrologium Romanum (2004).pdf")


@pytest.mark.skipif(not PDF.exists() or os.environ.get("SKIP_PDF"), reason="the 2004 PDF is not on this machine")
def test_real_pdf_finds_every_footnote_with_monthly_numbering():
    from extract_footnotes import CALENDAR_PAGES, merge_rows, pair, read_lines, scan

    markers, notes, _ = scan(merge_rows(read_lines(str(PDF), *CALENDAR_PAGES)))
    pairs, _ = pair(markers, notes)
    assert len(pairs) == EXPECTED_FOOTNOTES
    by_month: dict[int, list[int]] = {}
    for m, _n in pairs:
        by_month.setdefault(m.month, []).append(int(m.mark))
    assert all(marks == list(range(1, len(marks) + 1)) for marks in by_month.values())
```

Set `EXPECTED_FOOTNOTES` at the top of the test module to the count confirmed in Step 3 (after checking it against the crops).

- [ ] **Step 5: Run the tests**

Run: `python3 -m pytest tests -q`
Expected: all pass.

- [ ] **Step 6: Commit the script, test and empty overrides (not the raw data yet: it still has OCR errors)**

```bash
git add scripts/extract_footnotes.py tests/test_extract_footnotes.py .gitignore data/editions/martyrologium_romanum_2004/footnotes-overrides.json
git commit -m "feat: extract the 2004 Latin footnotes from the PDF, with a problems report and proofreading crops"
```

---

### Task 8: Texts: proofread the Latin footnotes against the scan

**Repo:** `martyrology-texts`, same branch.

**Files:**
- Modify: `data/editions/martyrologium_romanum_2004/footnotes-overrides.json`
- Generate: `data/editions/martyrologium_romanum_2004/footnotes.json`
- Modify: `README.md`

This is a reading task: every footnote's text and every unanchored mark are checked against the crop of its page.

- [ ] **Step 1: For each footnote in `footnotes.json`, open `footnote-crops/pNNN.png` for its page** (the problems report and the marks' pages tell which). Compare the text word by word with the print. Typical OCR errors in this scan: `6` for `ó`, `re` for `æ`, `ce` for `œ`, `l` for capital `I` at a word start (`loannes`), `0` for `O`, broken accents (`n6mina`). The print uses `æ`, `œ` and the accents, as the stored eulogy texts do.

- [ ] **Step 2: Record each correction in the overrides**, giving the whole corrected text, so a rerun reproduces it:

```json
{
  "mr:0115-ioannes-baptista-triquerie-et-socii": {
    "1": { "text": "Quorum nómina: beáti Ioánnes Baptísta Triquerie, ex Ordine Fratrum Minorum Conventualium; …" }
  }
}
```

For a mark the report says is unanchored, look at the eulogy's printed text in the crop of its page, find the word the superscript follows, and set `"after"` to that word (with its trailing punctuation) as it appears in `data/editions/martyrologium_romanum_2004/MM.json`, widened to two or three words if it occurs more than once. Verify with `python3 -c "import sys;sys.path.insert(0,'scripts');from extract_footnotes import whole_word_count as w;print(w(TEXT, PHRASE))"`, which must print `1`.

- [ ] **Step 3: Rerun and confirm**

Run: `python3 scripts/extract_footnotes.py "/mnt/c/Users/johnr/Documents/LitCal/Roman Martyrology/Martyrologium Romanum (2004).pdf"`
Expected: the same total as Task 7, and **no** "mark not anchored" problems left, except any you've confirmed print the mark where no word precedes it (then leave `after` null; the reader sets it at the end).

- [ ] **Step 4: Check every anchor against the stored texts** (a one-off check, run from the repo root)

```bash
python3 - <<'EOF'
import json, sys
sys.path.insert(0, "scripts")
from extract_footnotes import EDITION, load_texts, whole_word_count
from pathlib import Path
d = Path("data/editions") / EDITION
texts = load_texts(d)
bad = [(cid, f["mark"]) for cid, fs in json.loads((d / "footnotes.json").read_text()).items() for f in fs
       if f["after"] is not None and whole_word_count(texts[cid], f["after"]) != 1]
print("anchors that do not match exactly once:", bad)
EOF
```

Expected: `anchors that do not match exactly once: []`.

- [ ] **Step 5: Document** (`README.md`, under "Structure")

```markdown
- `data/editions/martyrologium_romanum_2004/footnotes.json`: the Latin print's footnotes under its eulogies (almost all *Quorum nomina*, the names behind "and companions"), by canonical ID, with the printed mark (numbered from 1 each month) and the phrase it follows. Generated by `scripts/extract_footnotes.py` from the PDF's OCR layer; corrections are kept by hand in `footnotes-overrides.json`, which the script applies last. The API returns them as each eulogy's `footnotes`.
```

- [ ] **Step 6: Commit**

```bash
git add data/editions/martyrologium_romanum_2004/footnotes.json data/editions/martyrologium_romanum_2004/footnotes-overrides.json README.md
git commit -m "data: the 2004 Latin footnotes, proofread against the print"
```

---

### Task 9: End to end, pull requests and release

**Repos:** all three.

- [ ] **Step 1: Run the API against the real data.** From `martyrology-api`, with the `feat/original-footnotes` branches of both repos checked out:

```bash
MARTYROLOGY_DATA_PATH="data/editions:../martyrology-texts/data/editions" MARTYROLOGY_CRMEDR_PATH=vendor/crmedr \
  .venv/bin/uvicorn martyrology_api.app:create_app --factory --port 8001
```

Then pick a footnoted eulogy from `footnotes.json`, e.g. the first January one, and check that `curl -s localhost:8001/api/v1/elogium/<id> | python3 -m json.tool` shows `"footnotes": []` for the 2004 placement anonymously. That's correct: the 2004 texts are restricted.

- [ ] **Step 2: See it in the reader.** Signed-in access is needed to read 2004 texts. Use the local Docker stack (`docker-compose.yml` in this repo) with the API image rebuilt from the branch, sign in as a user with `can_read_texts` on `martyrologium_romanum_2004`, and open that eulogy's day. Expect: a superscript number in the text colour after the anchor phrase; the footnote at the foot of the page under a short rule, before any curators' notes; both links working. Then open the same day facing the Italian edition: the footnote appears on the Latin sheet only.

- [ ] **Step 3: Open the three pull requests**, linking each other and the spec: `martyrology-api` (Tasks 1–2), `martyrology-frontend` (Tasks 3–4), `martyrology-texts` (Tasks 5–8). Each is safe alone: the API ignores a missing `footnotes.json`, the reader ignores a missing `footnotes` field, and the data is inert until the API reads it.

- [ ] **Step 4: Release after merging.** The API deploy bundles `martyrology-texts` through its `vendor/texts` submodule, so: merge the texts PR first; then in the API PR bump `vendor/texts` to that merge commit (`git update-index --cacheinfo 160000,<merge sha>,vendor/texts`, committed as "Bump martyrology-texts data pin") and check that `git ls-tree HEAD vendor/texts` shows the merged revision, since without it the deploy ships no `footnotes.json`; then merge and deploy the API, then the frontend (`gh workflow run deploy.yml --ref main` in each repo, which the user starts). Check production: an anonymous `GET https://api.romanmartyrology.com/api/v1/elogium/<id>` shows `"footnotes": []` for the 2004 placement, and the reader shows the footnote to a signed-in reader with access.

## Later plans (not in this slice)

- **Footnotes on a titulus or conclusio** (the spec's `"titulus:MM-DD"` keys): none were found in the Latin calendar, so this slice doesn't handle them. Add them in the plan for the first source that has one.

- **2004 Italian:** the same layout scan with the Italian PDF's sizes (born digital), marks paired with the Latin by eulogy and number, the lost letters restored from the Latin note.
- **2004 English:** a full survey first (the layout test found only July's notes), then the same scan.
- **1914 English:** keep the asterisk footnotes in `martyrology-api/scripts/digitize_1914_en.py` instead of dropping them, anchor each to its eulogy, and write `footnotes.json` into the public data.
