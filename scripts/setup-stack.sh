#!/usr/bin/env bash
#
# setup-stack.sh — provision the local Zitadel and discover the OpenFGA IDs,
# then write both into .env.
#
# SIBLING NOTE: this script is a near-duplicate of martyrology-api's
# scripts/setup-stack.sh (same repo family, same cdcf-infra provisioner, same
# hard-won fixes for the one-time-secret and awk-based set_env). They run on
# the HOST before any container exists, in two separate git repos with no
# submodule/package relationship, so there is no clean way to share the code
# without either coupling this repo's bring-up to a sibling checkout (which
# the GitHub-default compose path deliberately does not require) or building
# machinery disproportionate to ~180 lines of rarely-touched bash. Duplication
# was judged the least-bad option — see this repo's
# .superpowers/sdd/2026-08-04-local-development-stack/task-13-report.md for
# the full reasoning. If you change the shared parts of this file (the
# provisioning wait loop, the cdcf-infra clone, the capture-file handling,
# the OpenFGA store/model discovery — including the non-fatal `|| true`
# lookups and retry poll — or set_env), apply the same fix to
# martyrology-api's copy, and vice versa.
#
# Phase 2 of the three-phase bring-up (see README.md → "Local development
# stack"). The store ID, model ID, client IDs and client secrets are all
# GENERATED at provisioning time, so they cannot be committed; this script
# captures them.
#
# ⚠ Each client secret is emitted ONCE, by the run that creates its app.
# Zitadel's ListApplications API does not return secrets, so a re-run against
# an existing app cannot recover it. If .env is lost, rotate in the console:
#   Martyrology Org → Projects → MartyrologyAPI → Apps → Regenerate Client Secret
#
# Usage: ./scripts/setup-stack.sh --update-env

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

UPDATE_ENV=0
[[ "${1:-}" == "--update-env" ]] && UPDATE_ENV=1
if [[ $UPDATE_ENV -eq 0 ]]; then
    echo "Usage: $0 --update-env" >&2
    exit 64
fi

ENV_FILE=".env"
PAT_FILE="./.zitadel-data/automation-user.pat"
ZITADEL_PORT="$(grep -E '^ZITADEL_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
ZITADEL_PORT="${ZITADEL_PORT:-8080}"
OPENFGA_HTTP_PORT="$(grep -E '^OPENFGA_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
OPENFGA_HTTP_PORT="${OPENFGA_HTTP_PORT:-8083}"
PRESHARED_KEY="$(grep -E '^OPENFGA_PRESHARED_KEY=' "$ENV_FILE" | cut -d= -f2- || true)"
[[ -n "$PRESHARED_KEY" ]] || { echo "OPENFGA_PRESHARED_KEY missing from $ENV_FILE" >&2; exit 1; }
CDCF_INFRA_REF="$(grep -E '^CDCF_INFRA_REF=' "$ENV_FILE" | cut -d= -f2- || true)"
CDCF_INFRA_REF="${CDCF_INFRA_REF:-main}"
FRONTEND_PORT="$(grep -E '^FRONTEND_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

ISSUER="http://localhost:${ZITADEL_PORT}"
WORKDIR=".stack-out"
mkdir -p "$WORKDIR"

# --- wait for Zitadel -----------------------------------------------------
# --connect-timeout/--max-time bound EACH attempt so an unreachable host
# (wrong port, container not started) fails fast instead of hanging on
# curl's own defaults; the retry loop above already bounds total attempts
# (60x2s), and Zitadel's genuinely slow first boot is accommodated by
# retrying, not by a long per-attempt timeout.
CURL_TIMEOUT=(--connect-timeout 5 --max-time 15)
echo "Waiting for Zitadel at $ISSUER ..."
for _ in $(seq 1 60); do
    if curl -sf "${CURL_TIMEOUT[@]}" "$ISSUER/.well-known/openid-configuration" >/dev/null; then break; fi
    sleep 2
done
curl -sf "${CURL_TIMEOUT[@]}" "$ISSUER/.well-known/openid-configuration" >/dev/null \
    || { echo "Zitadel never became ready" >&2; exit 1; }
[[ -s "$PAT_FILE" ]] || { echo "PAT not found at $PAT_FILE" >&2; exit 1; }

# --- clone or refresh cdcf-infra -----------------------------------------
INFRA_DIR="$WORKDIR/cdcf-infra"
if [[ -d "$INFRA_DIR/.git" ]]; then
    git -C "$INFRA_DIR" fetch --quiet origin "$CDCF_INFRA_REF"
    git -C "$INFRA_DIR" checkout --quiet "FETCH_HEAD"
else
    git clone --quiet --depth 1 --branch "$CDCF_INFRA_REF" \
        https://github.com/CatholicOS/cdcf-infra.git "$INFRA_DIR"
fi

# --- provision Zitadel ----------------------------------------------------
# ZITADEL_PAT_FILE must be absolute: setup-zitadel.sh runs from auth/.
cat > "$INFRA_DIR/auth/.env.local" <<EOF
ZITADEL_ISSUER=$ISSUER
ZITADEL_INTERNAL_URL=$ISSUER
ZITADEL_PAT_FILE=$(cd "$(dirname "$PAT_FILE")" && pwd)/$(basename "$PAT_FILE")
ZITADEL_ADMIN_EMAIL=root@martyrology.localhost
EOF

OUT="$WORKDIR/zitadel-provision.out"
# The provisioner's stdout carries the one-time client secrets. Create the
# capture file with owner-only permissions BEFORE tee writes to it — tee
# opens an existing file without changing its mode, so pre-creating it
# closes the window where a secret would briefly land in a 644 file.
(umask 077; : > "$OUT")
chmod 600 "$OUT"
(
    cd "$INFRA_DIR/auth"
    ./setup-zitadel.sh --target local \
        --create-org Martyrology \
        --provision-martyrology \
        --provision-martyrology-frontend
) | tee "$OUT"

# The handoff block prints `KEY=value` lines, some with a trailing comment.
# Colours are suppressed automatically because stdout is a pipe.
val() { sed -n "s/^$1=\([^ ]*\).*/\1/p" "$OUT" | head -1; }

CLIENT_ID="$(val MARTYROLOGY_ZITADEL_CLIENT_ID)"
CLIENT_SECRET="$(val MARTYROLOGY_ZITADEL_CLIENT_SECRET)"
PROJECT_ID="$(val ZITADEL_PROJECT_ID)"
AUTH_ID="$(val AUTH_ZITADEL_ID)"
AUTH_SECRET_VAL="$(val AUTH_ZITADEL_SECRET)"

# Parsed — the capture file's only reason to exist is gone, and it is the
# one place a plaintext copy of a one-time secret could otherwise survive
# indefinitely at rest. Remove it now rather than leaving even a
# permission-protected copy around.
rm -f "$OUT"

[[ -n "$CLIENT_ID" ]]  || { echo "No client ID in provisioner output" >&2; exit 1; }
[[ -n "$PROJECT_ID" ]] || { echo "No project ID in provisioner output" >&2; exit 1; }
[[ -n "$AUTH_ID" ]]    || { echo "No frontend client ID in provisioner output" >&2; exit 1; }

# --- discover the OpenFGA IDs --------------------------------------------
# Queried from the API rather than parsed out of setup-openfga.sh's output:
# the store already exists (authz-seed created it), and an API read is stable
# where output parsing is not.
#
# Both substitutions below end in `|| true`. Under `set -euo pipefail`, a bare
# `STORE_ID="$(curl -sf ... | jq ...)"` aborts the whole script AT THE
# ASSIGNMENT the instant curl fails (OpenFGA down, wrong preshared key,
# connection refused) — before the "No Martyrology store found" guard two
# lines down, the one purpose-built to name the likely causes, ever gets to
# run. `|| true` lets a failed pipeline fall through to an empty STORE_ID
# instead, so the guard actually fires in the cases it exists for.
#
# This is also the only network read in the script with no retry (Zitadel
# above gets 60x2s). `docker compose up -d` does not wait for authz-seed —
# a `restart: "no"` one-shot — to finish, so a run of this script can
# legitimately land before the store has been seeded yet. Poll briefly
# rather than failing on that ordinary race.
FGA="http://localhost:${OPENFGA_HTTP_PORT}"
STORE_ID=""
for _ in $(seq 1 15); do
    STORE_ID="$(curl -sf "${CURL_TIMEOUT[@]}" -H "Authorization: Bearer $PRESHARED_KEY" "$FGA/stores" \
        | jq -r '.stores[] | select(.name=="Martyrology") | .id' | head -1 || true)"
    [[ -n "$STORE_ID" ]] && break
    sleep 2
done
[[ -n "$STORE_ID" ]] || {
    echo "No Martyrology store found at $FGA" >&2
    echo "  Likely causes: OpenFGA is not up, OPENFGA_PRESHARED_KEY in .env" >&2
    echo "  doesn't match the running stack's, or authz-seed hasn't finished" >&2
    echo "  seeding the store yet — check 'docker compose logs authz-seed'." >&2
    exit 1
}

MODEL_ID="$(curl -sf "${CURL_TIMEOUT[@]}" -H "Authorization: Bearer $PRESHARED_KEY" \
    "$FGA/stores/$STORE_ID/authorization-models?page_size=1" \
    | jq -r '.authorization_models[0].id' || true)"
[[ -n "$MODEL_ID" && "$MODEL_ID" != "null" ]] \
    || { echo "No authorization model in store $STORE_ID" >&2; exit 1; }

# --- write .env -----------------------------------------------------------
# Values come from Zitadel/OpenFGA and may contain arbitrary punctuation
# (secrets especially). A sed `s|^KEY=.*|KEY=VALUE|` splice would treat `&`
# in VALUE as "the whole matched line" (silent corruption, not an error) and
# `|` would break the delimiter — so the key/value are passed through the
# environment into awk instead, matched by literal prefix (no regex, no
# replacement-string metacharacters), never interpolated into program text.
# Written to a temp file and renamed in rather than edited in place, so a
# key that isn't present is appended exactly once and one that is present
# is replaced exactly where it stood.
set_env() {
    local key="$1" value="$2"
    local tmp
    tmp="$(mktemp "$(dirname "$ENV_FILE")/.env.XXXXXX")"
    SET_ENV_KEY="$key" SET_ENV_VALUE="$value" awk '
        BEGIN {
            key = ENVIRON["SET_ENV_KEY"]
            value = ENVIRON["SET_ENV_VALUE"]
            prefix = key "="
            found = 0
        }
        {
            if (!found && substr($0, 1, length(prefix)) == prefix) {
                print prefix value
                found = 1
            } else {
                print
            }
        }
        END {
            if (!found) print prefix value
        }
    ' "$ENV_FILE" > "$tmp"
    # mv replaces $ENV_FILE with the temp file's own mode, so re-assert 600
    # on the temp file before the swap rather than trusting it survives.
    chmod 600 "$tmp"
    mv "$tmp" "$ENV_FILE"
}

set_env MARTYROLOGY_ZITADEL_ISSUER       "$ISSUER"
set_env MARTYROLOGY_ZITADEL_INTERNAL_URL "$ISSUER"
set_env MARTYROLOGY_ZITADEL_CLIENT_ID    "$CLIENT_ID"
set_env MARTYROLOGY_ZITADEL_PROJECT_ID   "$PROJECT_ID"
set_env MARTYROLOGY_OPENFGA_API_URL      "$FGA"
set_env MARTYROLOGY_OPENFGA_STORE_ID     "$STORE_ID"
set_env MARTYROLOGY_OPENFGA_MODEL_ID     "$MODEL_ID"
set_env MARTYROLOGY_OPENFGA_API_TOKEN    "$PRESHARED_KEY"

if [[ -n "$CLIENT_SECRET" ]]; then
    set_env MARTYROLOGY_ZITADEL_CLIENT_SECRET "$CLIENT_SECRET"
    echo "✓ API client secret captured (one-time emit)."
else
    echo "⚠ No API client secret emitted — the app already existed." >&2
    echo "  Existing MARTYROLOGY_ZITADEL_CLIENT_SECRET in .env left untouched." >&2
    grep -qE '^MARTYROLOGY_ZITADEL_CLIENT_SECRET=.+' "$ENV_FILE" \
        || echo "  .env has NO secret. Rotate it in the Zitadel console." >&2
fi

set_env AUTH_URL             "http://localhost:${FRONTEND_PORT}"
set_env AUTH_ZITADEL_ISSUER  "$ISSUER"
set_env AUTH_ZITADEL_ID      "$AUTH_ID"

# AUTH_SECRET is ours to generate, not Zitadel's to emit. Generate once and
# keep it: regenerating invalidates every existing session cookie.
if ! grep -qE '^AUTH_SECRET=.+' "$ENV_FILE"; then
    set_env AUTH_SECRET "$(openssl rand -base64 32)"
fi

if [[ -n "$AUTH_SECRET_VAL" ]]; then
    set_env AUTH_ZITADEL_SECRET "$AUTH_SECRET_VAL"
    echo "✓ Frontend client secret captured (one-time emit)."
else
    echo "⚠ No frontend client secret emitted — the app already existed." >&2
    grep -qE '^AUTH_ZITADEL_SECRET=.+' "$ENV_FILE" \
        || echo "  .env has NO frontend secret. Rotate it in the Zitadel console." >&2
fi

# Belt and suspenders: set_env's mv already leaves $ENV_FILE at 600 (the
# temp file's own mode), but assert it explicitly — $ENV_FILE now holds live
# client secrets and must never be group/world-readable.
chmod 600 "$ENV_FILE"

echo
echo "✓ .env updated. Restart the API and frontend to pick up the new values."
