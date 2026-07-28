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
  - `GET /api/v1/elogia/edition/{edition}/{MM}/{DD}` — a day's eulogies for an edition.
  - `GET /api/v1/elogium/{canonical_id}` — a single eulogy (text + placement + `deprecated`).
  - `GET /api/v1/elogia?edition={edition}` — the catalog (all IDs for an edition) used to
    build the compare set-diff. (If the catalog does not include the `deprecated` flag, the
    flag is taken from the CRMEDR registry via the elogium/catalog response; see Open items.)
- **Change-set files** are loaded from the user's disk (file input) and exported as a
  download — the MVP does not read/write them through the API.

## Views

### 1. Compare

- Controls: choose **edition A** and **edition B** from the editions list; a day selector
  (month/day) with prev/next; a filter toggle (all / only-differences).
- Alignment: eulogies are joined by **canonical ID** (not by physical position), because the
  same ID may sit on different physical days across editions. For the chosen day (the MMDD
  anchor), show three groups: **in both**, **A-only**, **B-only**.
- Highlighting (per the curator's spec):
  - An ID present in A but not B → **RED** if it carries `deprecated: true`, **GREEN** if not.
  - An ID present in B but not A → same rule, mirrored.
  - In-both rows are neutral; if the two sides differ in placement/number/asterisk, show a
    subtle marker.
- Each row shows the canonical ID, the subject (per locale), and the eulogy incipit; clicking
  expands the full text (from `/elogium/{id}`). Per-day and running totals of
  both/A-only/B-only (and red/green counts) are shown.

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
- The CRMEDR `data/deprecated_id_corrections.json` maps onto this: `action:"rename"`→`rename`,
  `action:"delete"` with `class:"G-rubric"`→`delete`, `action:"delete"` with `class:"M-merge"`
  →`merge` (winner = `new_id`). A small converter (or a `--changeset` flag on the CRMEDR
  detect script) produces the v1 file; both are acceptable — the converter is simplest for MVP.

## Non-goals (MVP)

- No write-back to the API; no authentication; no user-authored operations (Phase B).
- No editing of eulogy *text* (texts are copyrighted / out of scope; only IDs/subjects).
- No production deployment; local-dev only.

## Open items (resolve during planning)

- Confirm the exact `martyrology-api` response shapes (editions list, day content, elogium)
  and whether the catalog/elogium response carries the `deprecated` flag; if not, decide how
  the compare view obtains it (registry endpoint vs. bundled CRMEDR registry snapshot).
- Confirm the API is runnable locally against the public-domain editions (the README's
  uvicorn instructions suggest yes); the frontend must degrade gracefully (clear error state)
  when the API or an edition is unavailable (e.g. the private 2004 edition → 404).
- Decide whether the CRMEDR→v1 converter lives in `crmedr` (as a detect-script flag) or as a
  small script in this repo; default: a script in this repo for MVP self-containment.

## Success criteria (MVP)

- With `martyrology-api` running locally, the Compare view aligns two public-domain editions
  by canonical ID and highlights A-only/B-only rows RED/GREEN by `deprecated` status.
- The Review view loads the converted normalization change-set, shows each proposal beside the
  real 1749 eulogy text, supports Accept/Reject/Edit with resumable local persistence, and
  exports a decided `crmedr-changeset/v1` file.
- That exported file, fed back to Claude Code, drives the CRMEDR Phase-2 apply on exactly the
  accepted/edited operations.
