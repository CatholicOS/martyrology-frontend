# Martyrology curation frontend (MVP) — design

**Status:** approved (design phase) · **Date:** 2026-07-28 · **Repo:** `martyrology-frontend`

## Purpose

A curation website for the Roman Martyrology data — the "curation website (review of draft
IDs, cross-edition comparison, proper-eulogy management)" named in the martyrology-api
architecture. It serves two needs:

1. **Cross-edition comparison** — view a single edition, or compare two editions side by side
   with eulogies aligned by canonical ID, highlighting where the ID sets diverge.
2. **Review / adjudication** — load a machine-generated change-set (e.g. the CRMEDR
   deprecated-ID normalization manifest), render each proposed change beside the real
   eulogy text, and let a curator Accept / Reject / Edit each one, exporting the decisions
   as JSON for Claude Code (or the API) to apply.

The immediate driver: the CRMEDR deprecated-ID normalization produced a 487-row correction
manifest that is cumbersome to review as raw JSON/Markdown. This tool makes that review
visual and interactive, and generalizes to future curation.

## Scope

**MVP (this spec):** the Compare view and the Review view, both read-only against a running
`martyrology-api`, plus loading/adjudicating/exporting a change-set JSON file. No write-back
to the API, no auth, no user-authored operations.

**Phase B (reserved, not built now):** authoring operations (mark two eulogies for merge with
a winning ID; mark a eulogy as *stray* to reunite with the previous; suggest an ID edit that
propagates across registries with conflict-checking); write-back via the API's curation
endpoints (PUT/PATCH/DELETE) with authentication (Zitadel/OpenFGA per cdcf-infra). The
change-set schema reserves operation types for these so nothing needs repainting later.

## Stack & repo

- New sibling repo `martyrology-frontend`, alongside `martyrology-api` and `crmedr`.
- **Next.js 16 (App Router, React Server Components) + React + TypeScript + Tailwind CSS v4**,
  matching `cdcf-website` and the CDCF brand system.
- Package manager and tooling follow `cdcf-website` conventions (npm, ESLint, Prettier).
- Runs locally: `npm run dev`, pointed at a locally-running `martyrology-api`.

## Architecture

```
martyrology-api (e.g. http://localhost:8000)
        ▲  server-side fetch (no CORS; API_BASE stays server-side)
        │
Next.js route handlers  (app/api/proxy/…)  ── thin proxy / typed client
        ▲
        │  RSC + client components
   React UI  ──loads──►  change-set JSON (Claude-Code output, from disk upload)
        │
        └──exports──►   decided change-set JSON  (to Claude Code / API)
```

- **API proxy layer:** Next.js server route handlers forward to `martyrology-api` using an
  `API_BASE` environment variable. The browser never talks to the API directly, so there is
  no CORS to configure and the API location is server-side config. A typed API client wraps
  the endpoints used.
- **API endpoints consumed (read-only):**
  - `GET /api/v1/editions` — list available editions (id, label, availability).
  - `GET /api/v1/elogia/edition/{edition}/{MM}/{DD}` — a day's eulogies for an edition
    (the eulogies **physically placed** on that day in that edition).
  - `GET /api/v1/elogium/{canonical_id}` — a single eulogy (text + placement).
- **Bundled CRMEDR registry + subjects snapshot.** The RED/GREEN coloring needs each ID's
  `deprecated` status, and the views benefit from the rest of CRMEDR's **public, non-copyrighted
  metadata**. Rather than depend on the API response shape, the frontend bundles a snapshot,
  committed into this repo under `data/` and refreshed by a script (`scripts/snapshot-registry.mjs`),
  built from CRMEDR's public files:
  - from `crmedr/data/martyrology_ids.json`: per ID — `deprecated`, `month`/`day`, `entry`,
    `asterisk`/`unnumbered`, `country` (ISO 3166-1 alpha-2), and `attested_in` for deprecated IDs.
  - from `crmedr/i18n/{la,it,en}.json`: per ID — the **subject** display name in each language
    (Latin fully filled; Italian/English partial).
  Shape: `data/registry-snapshot.json` = `{ id → { deprecated, month, day, entry, asterisk,
  unnumbered, country, attested_in, subject: { la, it, en } } }`. This makes CRMEDR the
  authoritative source for the flag and lets the UI show the **subject in the language matching
  the edition** (1749 Latin → `la`; 1914 English → `en`; an Italian edition → `it`) plus the
  country, without extra API calls. (The eulogy *text* still comes from the API and is not
  bundled; only public IDs/subjects/placement facts are.)
- **Change-set files** are loaded from a frontend-readable folder (see the converter below)
  and/or the user's disk (file input), and exported as a download — the MVP does not
  read/write them through the API.

## Views

### 1. Compare

- Controls: choose **edition A** and **edition B** from the editions list; a month selector
  and a day selector with prev/next; a filter toggle (all / only-differences).
- **Organized by physical day.** Eulogies are displayed **under the physical day they belong
  to in each edition** (the edition's own placement — the outer day key served by
  `/elogia/edition/{edition}/{MM}/{DD}`), NOT by the MMDD encoded in the canonical ID. Within
  a given physical day, edition A's and edition B's eulogies are aligned **by canonical ID**:
  - **in both** (same ID physically on this day in A and B) → neutral row.
  - **A-only** / **B-only** (ID physically on this day in one edition, not the other) →
    colored **RED** if the ID carries `deprecated: true`, **GREEN** if not (mirrored for the
    other side).
- **Cross-day IDs surface naturally.** A canonical ID whose intended anchor differs from its
  physical placement (e.g. `mr:1229-…` physically filed under a January day) appears under its
  *physical* day. If it sits on different physical days in A vs B, it shows as A-only on one
  day and B-only on another — making the discrepancy visible. (These are known data defects to
  be corrected later; the tool surfaces them, it does not hide them.)
- Each row shows the canonical ID, the **subject in the edition's language** and the
  **country** (from the bundled snapshot), and the eulogy incipit; clicking expands the full
  text (from `/elogium/{id}`). Per-day and running totals of both / A-only / B-only (and
  red / green counts) are shown.

### 2. Review (adjudication)

- Load a `crmedr-changeset/v1` JSON file (see schema). The view lists its operations.
- Each operation card shows:
  - The affected canonical ID(s) and operation type (`rename` / `delete` / `merge`).
  - The **real eulogy text fetched live from the API** (Latin, and English if present) for the
    affected ID — this is what makes the proposal judgeable without leaving the tool.
  - The proposed result: `rename` old → new (+ new subject); `delete` (+ reason); `merge`
    (the losing id(s) → winner).
  - Metadata: `class`, `confidence`, `reasoning`, `incipit`.
- Controls per operation: **Accept**, **Reject**, **Edit** (edit the `new_id` and/or subject
  inline; edits set `decision: "edit"` and record the new values). A running summary shows
  accepted/rejected/edited/undecided counts.
- Filters: by `class`, by `confidence` (surface low-confidence first), by `op`/`action`, and a
  "undecided only" toggle so a curator can work the queue down.
- **Export:** download the change-set with each operation's `decision` set and any edited
  fields applied — this is the file Claude Code consumes to apply Phase 2.
- Local persistence: decisions are kept in `localStorage` keyed by the change-set's identity
  so a reviewer can close and resume without losing work.

## The change-set schema — `crmedr-changeset/v1`

The durable, bidirectional interface between Claude Code and the frontend. One schema is
emitted by Claude Code (proposals), rendered and decided in the UI, and exported back.

```jsonc
{
  "schema": "crmedr-changeset/v1",
  "generated_by": "claude-code",              // or "curation-ui"
  "generated_at": "2026-07-28T00:00:00Z",     // optional
  "base": {
    "edition": "martyrologium_romanum_1749",  // edition the eulogy text comes from
    "registry": "crmedr@<sha>"                // registry the IDs are drawn from
  },
  "operations": [
    { "op": "rename", "id": "mr:0104-titi", "new_id": "mr:0104-titus",
      "subject_la": "Sanctus Titus",
      "class": "A-genitive", "confidence": "high",
      "incipit": "In Creta natalis sancti Titi…",
      "reasoning": "genitive→nominative",
      "decision": null,                        // UI: "accept" | "reject" | "edit"
      "edited": null                           // UI (when decision=="edit"): { new_id?, subject_la? }
    },
    { "op": "delete", "id": "mr:1225-quodsequitur-legitur-in",
      "reason": "rubric", "class": "G-rubric", "confidence": "high",
      "incipit": "Quod sequitur, legitur in tono…", "decision": null },
    { "op": "merge", "ids": ["mr:0108-severinus-neapoli"], "winner": "mr:0108-severinus",
      "class": "M-merge", "confidence": "low",
      "incipit": "Neapoli, in Campania, natalis sancti Severini…", "decision": null }
    // Phase B (schema-reserved, not rendered as authorable in MVP):
    //   { "op": "stray",   "id": "…", "reunite_with": "previous" }
    //   { "op": "id-edit", "id": "…", "new_id": "…", "propagate": true }
  ]
}
```

Rules:
- The MVP renders and adjudicates `rename`, `delete`, `merge`; it ignores unknown `op` values
  gracefully (shows them read-only with a "not adjudicable in this version" note).
- `decision` defaults to `null` (undecided). Export preserves every operation, decided or not.
- **`edited` is op-type-specific and overrides the top-level fields.** When `decision === "edit"`,
  `edited` carries only the keys the op type can edit: `rename` → `{new_id?, subject_la?}`,
  `merge` → `{winner?}`, `delete` → `{reason?}`. A consumer applying the change-set (CRMEDR
  Phase-2) MUST read the value from `edited` when present, not the (unchanged) top-level
  `new_id`/`winner`/`reason`.
- The CRMEDR `data/deprecated_id_corrections.json` maps onto this: `action:"rename"`→`rename`,
  `action:"delete"` with `class:"G-rubric"`→`delete`, `action:"delete"` with `class:"M-merge"`
  →`merge` (winner = `new_id`).

**Converter & change-set location.** A small converter script in this repo
(`scripts/import-changeset.mjs`, Node, no deps) reads a CRMEDR manifest
(`../crmedr/data/deprecated_id_corrections.json` by default, path overridable), transforms it
to `crmedr-changeset/v1`, and writes it into a **frontend-readable folder committed to this
repo** — `data/changesets/<name>.json`. The Review view lists change-sets found there and
also accepts an ad-hoc file upload. Keeping the change-set inside this repo (not read live
from CRMEDR) means the frontend has a stable, self-contained input; refreshing it is an
explicit `npm run import-changeset` step. The registry snapshot for the deprecated flag is
produced by the same or a sibling script (`scripts/snapshot-registry.mjs` →
`data/registry-deprecated.json`).

## Non-goals (MVP)

- No write-back to the API; no authentication; no user-authored operations (Phase B).
- No editing of eulogy *text* (texts are copyrighted / out of scope; only IDs/subjects).
- No production deployment; local-dev only.

## Resolved decisions (from review)

- **Deprecated flag & metadata:** bundled CRMEDR registry + subjects snapshot (above).
- **Compare organization:** by physical day; align by canonical ID within a day; cross-day IDs
  surface as anomalies rather than being hidden.
- **Converter & change-set location:** a script in this repo writes `crmedr-changeset/v1`
  into `data/changesets/` (self-contained; not read live from CRMEDR).

## Open items (resolve during planning)

- Confirm the exact `martyrology-api` response shapes (editions list, day content, single
  elogium) by reading the API's models/routers during planning, so the typed client matches.
- Confirm the API is runnable locally against the public-domain editions (the README's uvicorn
  instructions suggest yes); the frontend must degrade gracefully (clear error state) when the
  API or an edition is unavailable (e.g. the private 2004 edition → 404).

## Success criteria (MVP)

- With `martyrology-api` running locally, the Compare view aligns two public-domain editions
  by canonical ID and highlights A-only/B-only rows RED/GREEN by `deprecated` status.
- The Review view loads the converted normalization change-set, shows each proposal beside the
  real 1749 eulogy text, supports Accept/Reject/Edit with resumable local persistence, and
  exports a decided `crmedr-changeset/v1` file.
- That exported file, fed back to Claude Code, drives the CRMEDR Phase-2 apply on exactly the
  accepted/edited operations.
