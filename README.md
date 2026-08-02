# Martyrology Curation Frontend

A curation website for the Roman Martyrology data pipeline: it lets a curator
**compare** how a canonical eulogy ID is placed across editions, and **review**
(accept/reject/edit) a proposed change-set of ID corrections against the real,
live eulogy text served by the [`martyrology-api`](https://github.com/CatholicOS/martyrology-api).

It contains no copyrighted texts at rest — everything it displays comes either
from the bundled public [CRMEDR](https://github.com/CatholicOS/crmedr) registry
snapshot (IDs, placement, multilingual subject headwords) or is fetched live
from the API for the actual eulogy text.

- `/compare` — pick two editions; see every physical day (month/day) with rows
  aligned by canonical ID. Deprecated-only IDs render RED, non-deprecated-only
  IDs render GREEN, and IDs that this edition places on a different physical
  day than the registry's canonical day (a "cross-day" placement) get a badge.
- `/review` — load a bundled change-set (e.g. `deprecated-id-normalization`),
  see each operation (rename/delete/merge/…) alongside the live 1749 Latin text
  for the affected ID(s), and Accept / Reject / Edit each one. Decisions persist
  in `localStorage` (reload-safe) and can be exported as a new
  `crmedr-changeset/v1` JSON file with `decision`/`edited` filled in.

## Prerequisites

- Node.js 20+
- A running instance of [`martyrology-api`](https://github.com/CatholicOS/martyrology-api)
  (see that repo's README for `pip install -e '.[dev]'` and
  `uvicorn martyrology_api.app:create_app --factory --reload`). By default it
  serves the public-domain editions (1749, 1914, and the old English
  translations) — no private data repository needed to develop against.
- A sibling checkout of [`crmedr`](https://github.com/CatholicOS/crmedr) at
  `../crmedr` (only needed to regenerate the bundled registry snapshot / import
  a new change-set — the app itself does not read `crmedr` at runtime).

## Setup

```bash
npm install
cp .env.example .env
```

`.env` sets `API_BASE`, the upstream URL the server-side proxy
(`app/api/mr/[...path]/route.ts`) forwards to — default `http://localhost:8000`.

## Data scripts

Both scripts read the sibling `../crmedr` checkout and write into this repo;
re-run them whenever the registry or the correction manifest changes upstream.

```bash
# Rebuild data/registry-snapshot.json from ../crmedr's canonical registry
# (data/martyrology_ids.json) + i18n subject files (i18n/{la,it,en}.json).
npm run snapshot-registry

# Convert ../crmedr/data/deprecated_id_corrections.json into a
# crmedr-changeset/v1 file under public/changesets/, and regenerate
# public/changesets/index.json (the manifest the Review page's change-set
# picker fetches).
npm run import-changeset
```

Both accept optional positional args — see the top of each script under
`scripts/` for the exact CLI (source path, output name, base edition).

## Running

```bash
npm run dev
```

Then open:

- [http://localhost:3000/compare](http://localhost:3000/compare)
- [http://localhost:3000/review](http://localhost:3000/review)

`/compare` and eulogy text in `/review` require a reachable `martyrology-api`
(`API_BASE`); if it's unreachable, the proxy returns a `502` with an
`"API unreachable"` title and the UI shows a clear banner instead of a blank
page or crash.

**Note on the 2004 edition:** the default/bare edition path
(`/api/v1/elogia/...` without an explicit edition) resolves to the 2004
*editio typica altera*, whose text lives in a private data repository that is
attached only at deployment time. Against a public-only clone of
`martyrology-api` (the normal dev setup), requests for that edition return an
honest `404` — use the public-domain editions instead, e.g.
`martyrologium_romanum_1749`, `martyrologium_romanum_1914_la`,
`martyrologium_romanum_1914_en_unofficial`.

## Change-set format

The `crmedr-changeset/v1` schema (rename / delete / merge operations, each
carrying `class`/`confidence`/`incipit`/`reasoning` plus a curator
`decision`/`edited` slot) is specified in
[`docs/superpowers/specs/2026-07-28-martyrology-curation-frontend-mvp-design.md`](docs/superpowers/specs/2026-07-28-martyrology-curation-frontend-mvp-design.md)
under "The change-set schema — `crmedr-changeset/v1`". The TypeScript types and
converter/loader live in `lib/changeset.ts` and `scripts/import-changeset.mjs`.

## Tests

```bash
npm test          # vitest
npx tsc --noEmit  # typecheck
npm run build     # production build
```

## Deployment

Production runs at [romanmartyrology.com](https://romanmartyrology.com) on the
same Plesk-managed VPS as the API, under the **Plesk Node.js extension**
(Phusion Passenger). `.github/workflows/deploy.yml` deploys on
`release: published` (or `gh workflow run deploy.yml --ref main`): it builds the
`output: "standalone"` bundle, ships it over `scp`, unpacks it into the vhost,
and restarts Passenger by touching `tmp/restart.txt`. Nothing is installed on
the VPS — `standalone` bundles its own pruned `node_modules`.

`API_BASE` resolves in two layers: the workflow writes `vars.API_BASE` into the
bundle as the shipped default, and a **Custom environment variable** set in the
Plesk Node.js panel overrides it live without a redeploy.

Required repository configuration, and the one-time Plesk setup, are listed in
[`docs/superpowers/specs/2026-08-02-frontend-deployment-design.md`](docs/superpowers/specs/2026-08-02-frontend-deployment-design.md).
That document also records why Passenger is used here while the API uses a
systemd unit, and why the deployed site cannot show the restricted 2004 text.
