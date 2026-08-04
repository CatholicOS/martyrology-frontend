#!/usr/bin/env bash
#
# smoke.sh — full-stack bring-up invariants.
#
# Checks wiring, not behaviour. Run after `setup-stack.sh --update-env` and a
# `docker compose up -d --force-recreate` of the application services.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a; . ./.env; set +a

PASS=0; FAIL=0; SKIP=0
ok()   { printf '  ✓ %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  ✗ %s\n' "$1"; FAIL=$((FAIL+1)); }
skip() { printf '  ~ %s\n' "$1"; SKIP=$((SKIP+1)); }

API="http://localhost:${API_PORT:-8000}"
FE="http://localhost:${FRONTEND_PORT:-3000}"
FGA="${MARTYROLOGY_OPENFGA_API_URL:-http://localhost:8083}"
ISSUER="http://localhost:${ZITADEL_PORT:-8080}"

echo "1. Zitadel discovery on the single origin"
[[ "$(curl -sf "$ISSUER/.well-known/openid-configuration" | jq -r '.issuer')" == "$ISSUER" ]] \
    && ok "issuer is $ISSUER" || bad "discovery missing or issuer mismatch"

echo "2. OpenFGA structural tuples"
COUNT=$(curl -sf -X POST "$FGA/stores/$MARTYROLOGY_OPENFGA_STORE_ID/read" \
    -H "Authorization: Bearer $MARTYROLOGY_OPENFGA_API_TOKEN" \
    -H "Content-Type: application/json" -d '{}' | jq '.tuples | length')
[[ "$COUNT" == "11" ]] && ok "11 structural tuples" || bad "expected 11 tuples, got ${COUNT:-none}"

echo "3. Alembic is at head"
CUR=$(docker compose run --rm --entrypoint alembic api-migrate current 2>/dev/null | tr -d '\r')
grep -q '(head)' <<<"$CUR" && ok "alembic current is at head" || bad "alembic not at head: $CUR"

echo "4. API health"
curl -sf "$API/healthz" >/dev/null && ok "GET /healthz 200" || bad "GET /healthz failed"

echo "5. Anonymous read of a restricted edition is redacted"
BODY=$(curl -sf "$API/api/v1/elogia/edition/martyrologium_romanum_2004/01/02" 2>/dev/null)
if [[ -z "$BODY" ]]; then
    skip "martyrologium_romanum_2004 not attached (no override / no martyrology-texts)"
else
    ACCESS=$(jq -r '.metadata.access // empty' <<<"$BODY")
    TEXT=$(jq -r '.elogia[0].text // "null"' <<<"$BODY")
    [[ "$ACCESS" == "restricted-texts" && "$TEXT" == "null" ]] \
        && ok "access=restricted-texts with text=null" \
        || bad "expected redaction, got access=$ACCESS text=$TEXT"
fi

echo "6. Login V2 is served through the proxy"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$ISSUER/ui/v2/login/login")
[[ "$CODE" != "404" && -n "$CODE" ]] \
    && ok "/ui/v2/login/login -> $CODE" \
    || bad "/ui/v2/login/login returned 404 — proxy is routing to the backend"

echo "7. Auth.js provider"
PROVIDERS=$(curl -sf "$FE/api/auth/providers" 2>/dev/null)
if [[ -z "$PROVIDERS" ]]; then
    # Auth.js is introduced by the OIDC login-client plan, not by this stack.
    skip "no /api/auth/providers — Auth.js not yet wired into the frontend"
else
    jq -e '.zitadel' >/dev/null <<<"$PROVIDERS" \
        && ok "zitadel provider registered" || bad "zitadel missing from providers"
fi

echo
printf 'passed %d, failed %d, skipped %d\n' "$PASS" "$FAIL" "$SKIP"
[[ $FAIL -eq 0 ]]
