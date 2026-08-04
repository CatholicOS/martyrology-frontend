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

- Node.js 24+ (see `.nvmrc`; `package.json`'s `engines` and the `Dockerfile`
  agree)
- A running instance of [`martyrology-api`](https://github.com/CatholicOS/martyrology-api)
  (see that repo's README for `pip install -e '.[dev]'` and
  `uvicorn martyrology_api.app:create_app --factory --reload`). By default it
  serves the public-domain editions (1749, 1914, and the old English
  translations) — no private data repository needed to develop against.
- A sibling checkout of [`crmedr`](https://github.com/CatholicOS/crmedr) at
  `../crmedr` (only needed to regenerate the bundled registry snapshot / import
  a new change-set — the app itself does not read `crmedr` at runtime).
- Docker with Compose v2, `curl`, `jq`, `git`, and `openssl` (only needed for
  the full local development stack below — see that section for what each
  one is used for).

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

## Local development stack

Runs the whole system — Zitadel, OpenFGA, Postgres, the API and this frontend —
in Docker. Mirrors `cdcf-infra` production topology: Zitadel and its v2 login UI
share one origin behind an nginx proxy, with image versions pinned to
production's.

Requires Docker with Compose v2, `curl`, `jq`, `git`, and `openssl` — the
provisioning and smoke scripts shell out to all four (`curl`/`jq` to talk to
Zitadel and OpenFGA, `git` to clone `cdcf-infra`, `openssl` to generate
`AUTH_SECRET`); a missing one otherwise surfaces as a bare "command not found"
partway through provisioning, with nothing pointing at the cause. Ports match
LiturgicalCalendar's stack, so only one of the two can run at a time.

```bash
cp .env.example .env
docker compose up -d
./scripts/setup-stack.sh --update-env
docker compose up -d --force-recreate martyrology-api martyrology-frontend
./scripts/smoke.sh
```

There is no sign-in on the frontend yet — that arrives with the OIDC
login-client plan (see smoke assertion 7, which skips until then). Until it
does, create/find your user in the Zitadel console
(<http://localhost:8080/ui/console>, Martyrology Org → Users), copy its `sub`
(→ your user → ID), and grant yourself platform superuser:

```bash
./scripts/grant-superuser.sh <your-sub>
```

| Service | URL | Credentials |
| --- | --- | --- |
| Frontend | <http://localhost:3000> | — |
| API | <http://localhost:8000> | — |
| Zitadel console | <http://localhost:8080/ui/console> | `root@martyrology.localhost` / `RootPassword1!` |
| OpenFGA API | <http://localhost:8083> | Bearer `OPENFGA_PRESHARED_KEY` from `.env` |
| Adminer | <http://localhost:8088> | server `db`, user `postgres`, password `postgres` |
| Mailpit | <http://localhost:8025> | — |

There is no OpenFGA Playground in this stack — v1.15.1 panics at startup when
the Playground is enabled alongside the preshared auth this stack requires.
Inspect a store's tuples with `curl` instead, e.g.:

```bash
set -a; . ./.env; set +a   # loads MARTYROLOGY_OPENFGA_API_URL/STORE_ID/API_TOKEN
curl -s -X POST "$MARTYROLOGY_OPENFGA_API_URL/stores/$MARTYROLOGY_OPENFGA_STORE_ID/read" \
  -H "Authorization: Bearer $MARTYROLOGY_OPENFGA_API_TOKEN" \
  -H "Content-Type: application/json" -d '{}' | jq
```

### Building from local checkouts

By default every service builds from its GitHub ref, so a bare clone stands the
whole system up. To build from sibling checkouts instead:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up -d --build
```

The override also mounts `../martyrology-texts`, which is **the only way** the
restricted-texts path becomes exercisable — that repo is private, so the
GitHub-default stack serves the two public-domain editions only.

### Iterating on the frontend

This image is a production Next.js build and does not hot-reload from a bind
mount. Stop the container and use the dev server:

```bash
docker compose stop martyrology-frontend
npm run dev
```

Port 3000 is then free and the registered OIDC callback still matches.

### Gotchas

- **The OIDC client secrets are emitted once.** `setup-stack.sh` captures them
  into `.env` on the run that creates each app (the API app and the frontend
  app are provisioned — and can be created — independently); a re-run cannot
  recover a secret for an app that already existed. If `.env` is lost,
  regenerate in the Zitadel console.
- **`AUTH_SECRET` is generated once and never rotated by this script.**
  Regenerating it invalidates every existing session cookie, so
  `setup-stack.sh` only ever writes it when `.env` doesn't already have one.
- **`OPENFGA_PRESHARED_KEY` is required.** The API's `authz_enabled` is false
  when its token is empty, which denies every authorization check while the
  stack reports healthy.
- **`ZITADEL_PORT` overrides the issuer origin — every OIDC client in the
  stack follows it, but the port still has to actually be free.** Override it
  in your local `.env` (never in `.env.example`) when something on the host
  already holds 8080. On Docker Desktop for Windows/WSL2, the published port
  is bound on the **Windows host**, not just inside WSL — `ss`/`netstat` run
  *inside* WSL will not show a Windows-side process holding it. A conflicting
  publish fails **silently**: `docker compose ps` reports the proxy healthy,
  and only `docker inspect martyrology-zitadel-proxy-1` reveals the port
  binding never actually took (an empty `HostIp`/`HostPort`). If Zitadel
  discovery or login is unreachable despite a healthy `zitadel-proxy`, check
  `docker inspect` before anything else.
- **Port 3000 is fixed.** `cdcf-infra` registers
  `http://localhost:3000/api/auth/callback/zitadel` for `--target local`.

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
