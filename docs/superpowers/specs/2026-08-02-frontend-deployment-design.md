# Frontend Deployment Design

**Date:** 2026-08-02
**Status:** **Live** at https://romanmartyrology.com since 2026-08-02. The
workflow deploys end to end; the Plesk Node.js application is configured per §7
step 1. The first run (30759983162) shipped the bundle correctly and failed only
its smoke test, because the Node.js application had been filled in but not
enabled — the findings from that are folded into §7 step 1.
**Companion:** `martyrology-api`'s
`docs/superpowers/specs/2026-08-01-continuous-deployment-design.md`, which
deploys the upstream API to the same VPS by a deliberately different route.

## Problem

The curation frontend is a Next.js application whose server side is not
optional: `app/api/mr/[...path]/route.ts` is a request-time proxy to the API,
so the site cannot be a static export. It must therefore run a Node process.

The API solved the same "run a long-lived process on a Plesk box" problem with a
systemd unit and an nginx reverse proxy, on the explicit grounds that Plesk has
no ASGI support. That reasoning does not carry over: Plesk *does* have
first-class Node support, and the target domain is already a Plesk subscription
configured to use it. Deployment must fit inside the Plesk Node.js extension
rather than around it.

## Verified environment facts

Established 2026-08-02 by DNS lookup, `ssh-keyscan`, and HTTP probing:

| Fact | Value |
|---|---|
| Frontend domain | `romanmartyrology.com` → 92.222.13.29 |
| Currently served | Plesk "Domain Default page" — subscription created, vhost empty |
| API domain | `api.romanmartyrology.com` → 92.222.13.29, `/healthz` 200 |
| Same host as the API? | **Yes** — `ssh-keyscan romanmartyrology.com` returns host keys byte-identical to the API repo's pinned `VPS_HOST_KEY` |
| Web front end | Plesk-managed nginx (`x-powered-by: PleskLin`) |
| Node runtime | Plesk Node.js extension (Phusion Passenger) |
| SSHFP records | none published for `romanmartyrology.com` |

### `martyrology.com` is a different server

`martyrology.com` resolves to 172.104.149.86 and `www.martyrology.com` to
139.162.181.76 — both Linode, neither this VPS, neither answering on port 22,
and both presenting a certificate this toolchain cannot verify. The domain is
**not** the deploy target today. If it is later re-pointed at the Plesk box and
added to the subscription, the only change required is `vars.SITE_URL` (plus a
Plesk domain alias and a reissued certificate); nothing structural depends on
the hostname.

## 1. Why Passenger rather than a second systemd unit

The API's own design rejected Passenger — but for the API, which is ASGI, and
Passenger has no ASGI mode. Next.js is a plain Node HTTP server, which is
exactly what Passenger's Node support exists to run. Reusing the Plesk
mechanism buys:

- **TLS and Let's Encrypt renewal stay Plesk's problem**, which was already the
  decisive argument for keeping the API inside Plesk's nginx rather than
  bypassing it.
- **No new privileged surface.** A systemd unit would need a second sudoers
  drop-in for `systemctl restart`. Passenger's restart protocol is *touching a
  file the deploy user already owns*, so the deploy identity needs no sudo at
  all — a strictly smaller blast radius than the API's deploy user has.
- **No port to allocate or keep in sync.** The API's port lives in two places
  (`runtime.env` and the nginx directive) and its design doc records that
  coupling as manual and error-prone. Passenger assigns and wires the socket
  itself.

The cost is that Plesk pins the application root to one fixed directory, which
rules out the API's atomic `current ->  releases/<version>` symlink flip. See
§5 for what is given up with it.

## 2. Why `output: "standalone"`

`next.config.ts` sets `output: "standalone"`, which emits a `server.js` plus a
pruned `node_modules` containing only what the server actually requires.

The alternative — ship the repo and run `npm ci` on the VPS — requires npm, a
toolchain, and network egress inside the subscription's shell. The deploy
identity is a Plesk subscription user whose command execution is restricted
(§4), so that is exactly the wrong dependency to take on. A standalone bundle
needs no remote command beyond unpacking it.

### What tracing does and does not follow

`standalone` decides what to bundle by tracing `require` graphs. It does **not**
follow `dlopen`, and the bundle is consequently not pure JavaScript — it carries
`@img/sharp-linux-x64/lib/*.node`, a glibc-linked native addon, plus the libvips
shared object that addon opens at load time.

This bit once, on 2026-08-02, while clearing Dependabot alert #7
(GHSA-f88m-g3jw-g9cj, four libvips CVEs). `package.json` overrides `sharp` to
`^0.35.3`; `next@16.2.12` pins `^0.34.5`. In 0.34 libvips is linked into the
`.node` binary, so tracing the binary sufficed. 0.35 splits it into a separate
`libvips-cpp.so` opened via `dlopen`, which tracing misses — so the bundle
shipped `sharp` without the library it needs.

The failure mode is why this is written down rather than just fixed:

- the build succeeds;
- every route serves 200, and the full test suite passes;
- nothing is wrong until something actually calls `sharp`, which then throws
  `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file`;
- it **cannot reproduce in development**, where the full `node_modules` is on
  disk. Only the bundle is broken.

Today nothing imports `sharp` — there is no `next/image` usage and `public/`
holds three JSON files and no images — so the breakage would have lain dormant
until someone added an image, and then presented as "works locally, fails in
production" with no recent change to blame.

The tell is quantitative: the bundle dropped from 11MB to 3.8MB. **A deploy
bundle that suddenly gets smaller is a bundle that lost something.**
`outputFileTracingIncludes` in `next.config.ts` pulls the `.so` back in (12MB),
and is removable once Next ships a stable release pinning `sharp ^0.35.x`.

Verifying a bundle boots is therefore not sufficient on its own. The check that
would have caught this is:

```bash
(cd <extracted-bundle> && node -e "const s=require('sharp'); console.log(s.versions.vips)")
```

Two directories are **not** included by `standalone` and must be copied in by
the caller, which the workflow does:

- `.next/static` — without it every page renders unstyled and every JS chunk
  404s.
- `public/` — without it `public/changesets/*.json` 404s and the Review page's
  change-set picker has nothing to load.

## 3. Runtime configuration: `API_BASE`

`app/api/mr/[...path]/route.ts:3` reads `process.env.API_BASE`, falling back to
`http://localhost:8000`. That fallback is a development convenience and is
actively wrong in production.

Empirically verified against Next 16.2.12 on 2026-08-02:

1. `next build` **copies whatever `.env` it loaded into `.next/standalone/.env`**,
   and that file **is read again at runtime** by the standalone server. A build
   on a developer machine therefore produces a bundle carrying
   `API_BASE=http://localhost:8000`. (`.env` is gitignored, so a CI build has no
   such file — but the workflow overwrites `.env` unconditionally rather than
   depend on which case produced the build.)
2. A **real process environment variable takes precedence** over that file.

That yields the intended two-layer configuration:

| Layer | Set where | Role |
|---|---|---|
| `.next/standalone/.env` | written by the deploy workflow from `vars.API_BASE` | the default that ships with each release |
| process environment | Plesk → Node.js → **Custom environment variables** | overrides it live, without a redeploy |

`vars.API_BASE` is validated as non-empty and the workflow **fails rather than
defaults**. The API's loopback port is chosen per-host and recorded in
`/opt/martyrology/config/runtime.env` as `MARTYROLOGY_PORT`; the API design doc
proposes 8412 but explicitly marks it as requiring verification. Guessing it
here would bake a wrong URL into the bundle and surface only as a 502 after the
release had already shipped.

### The loopback URL grants no extra access

Worth recording, because it is a natural assumption and it is false. The API
derives identity **only** from `Authorization: Bearer <token>`
(`martyrology-api/src/martyrology_api/auth.py:93-108`) — no cookie, no session,
no IP allowlist, no localhost bypass. `texts_allowed()` in `licensing.py` then
requires both an identity and an OpenFGA `can_read_texts` relation before it
will return text for a restricted edition, and the three 2004 editions are
restricted by default (`config.py:13-17`).

So `http://127.0.0.1:<port>` and `https://api.romanmartyrology.com` return
identical bodies. The choice is latency and coupling only.

**Consequence for the 2004 editio typica.** The proxy forwards no
`Authorization` header, so `OperationCard.tsx:20`'s request for
`martyrologium_romanum_2004` comes back with `text: null` and
`metadata.access = "restricted-texts"`, and `EulogyView.tsx` falls back to the
change-set's base edition. This is **not a deployment regression** — a local API
with `MARTYROLOGY_ZITADEL_ISSUER` empty behaves identically — but it does mean
the 2004 text stays dark in production until the frontend can present a token.
Giving it one (an OIDC login, or a service-account token held in the Plesk
environment panel) is deliberately out of scope here; it is an authentication
feature, not a deployment step.

## 4. The deploy identity

The API deploys as `martyrology-deploy`, a dedicated non-chrooted user that owns
`/opt/martyrology`. That user is **not** reusable here: the Plesk vhost is owned
by the subscription's own system user, and `martyrology-deploy` cannot write to
it.

The frontend therefore deploys as the **subscription user**, already recorded in
`secrets.VPS_USERNAME`, with `vars.VPS_APP_DIR = /httpdocs`. That path being
chroot-*relative* is the tell: Plesk's "chrooted shell" access type roots the
user's filesystem at the vhost directory, so `/httpdocs` inside the session is
`/var/www/vhosts/romanmartyrology.com/httpdocs` outside it. Both the `scp`
destination and the remote `tar` run inside that chroot, so the same path is
correct on both sides.

### Probing the deploy identity — RESOLVED 2026-08-02

The workflow's activate step needs `tar`, `gzip`, `mkdir` and `touch` to be
executable by the deploy identity. Probed with the deploy key itself, which
tests the exact path the workflow takes rather than inferring it from the host
side:

```console
$ ssh -i ~/.ssh/martyrology-frontend-deploy '<VPS_USERNAME>@catholicdigitalcommons.org' \
      'echo AUTH_OK; command -v tar gzip mkdir touch; ls -d /httpdocs'
AUTH_OK
/usr/bin/tar
/usr/bin/gzip
/usr/bin/mkdir
/usr/bin/touch
/httpdocs
```

All four are present and `/httpdocs` resolves, so **the workflow as written is
correct** — none of the fallbacks below are needed. They are retained because
they become relevant again if the subscription's SSH access type is ever
tightened (for instance to SFTP-only), which would break the deploy in a way
whose remedy is otherwise non-obvious.

The host-side equivalent, if the identity ever needs re-checking without the
key — run as root on the VPS:

```bash
# 1. Which system user owns the vhost, and what shell does it have?
#    /usr/local/psa/bin/chrootsh  → chrooted (the assumed case)
#    /bin/bash or /bin/sh         → full shell, everything below is moot
#    /bin/false or /sbin/nologin  → SFTP only: NO command execution at all
OWNER=$(stat -c %U /var/www/vhosts/romanmartyrology.com/httpdocs)
echo "owner=$OWNER"; getent passwd "$OWNER"

# 2. If chrooted: what does the chroot actually contain?
ls /var/www/vhosts/romanmartyrology.com/{bin,usr/bin} 2>/dev/null \
  | grep -E '^(tar|gzip|mkdir|touch|sh|bash)$' || echo "NONE OF tar/gzip/mkdir/touch FOUND"

# 3. Confirm the vhost tmp/ the workflow stages the tarball in exists
ls -ld /var/www/vhosts/romanmartyrology.com/tmp
```

Outcomes and what each implies:

| Result | Action |
|---|---|
| Full shell, or chroot has all four binaries | Nothing to change; the workflow as written is correct. **← the observed case** |
| Chroot lacks `mkdir`/`touch` but has `tar` | Ship `tmp/restart.txt` as the **last** member of the tarball; extraction alone then updates its mtime and triggers the Passenger restart. Drop the `mkdir`/`touch` from the activate step. |
| Chroot lacks `tar` | Replace the tarball with an SFTP upload of the unpacked tree (`scp -r`, or `rsync -e ssh` if available). Correct but slow — the standalone bundle is ~40 MB across thousands of small files. |
| SFTP only, no command execution | Same as above for the upload, and `tmp/restart.txt` must be uploaded as a file rather than touched. Passenger restarts on mtime change, which an SFTP `put` provides. |

## 5. What is given up: no atomic release flip

Plesk pins the application root to one directory, so each deploy extracts **over
the previous release** rather than into `releases/<version>` with a symlink flip.
Three consequences, all accepted:

- **No atomic switch.** There is a sub-second window mid-extraction where the
  tree is mixed. Passenger is not restarted until afterwards, and the running
  process holds its already-loaded modules, so in practice the exposure is to
  static-asset requests only.
- **No rollback-on-unhealthy.** The API's `deploy.sh` flips `current` back and
  exits non-zero when `/healthz` fails. Here the smoke test can only *report* a
  bad deploy; recovery is re-running the workflow against the previous release.
- **Pruning.** Files removed between releases linger — stale
  `.next/static/<old-build-id>/` trees, packages dropped from `node_modules`.
  This is dead weight, not a correctness problem, because every manifest that
  routes to them is overwritten. Left unaddressed deliberately: an `rm -rf` of
  the app directory mid-deploy trades slow disk growth for a window in which the
  site is definitively broken. If the vhost's disk use becomes a problem, prune
  `.next/static/*` out of band, not from the deploy path.

## 6. Repository configuration

| Kind | Name | Value | Status |
|---|---|---|---|
| Secret | `VPS_HOST` | `catholicdigitalcommons.org` | set 2026-08-02 |
| Secret | `VPS_USERNAME` | the subscription's system user | set 2026-07-29 |
| Secret | `VPS_SSH_KEY` | private half of the deploy keypair | **to set** — see §6.1 |
| Variable | `VPS_HOST_KEY` | `ssh-keyscan -t ed25519,rsa catholicdigitalcommons.org` | set 2026-08-02 |
| Variable | `VPS_APP_DIR` | `/httpdocs` | set 2026-07-29 |
| Variable | `SITE_URL` | `https://romanmartyrology.com` | set 2026-08-02 |
| Variable | `API_BASE` | `http://127.0.0.1:<MARTYROLOGY_PORT>` | **to set** |

**`VPS_HOST` is the SSH endpoint, `SITE_URL` is the public site — they are
deliberately different hostnames for the same machine.**
`catholicdigitalcommons.org` is the server's primary domain and the name under
which it is administered; `romanmartyrology.com` is one subscription on it. The
two are decoupled so that re-pointing the public site (for instance onto
`martyrology.com`, §"Verified environment facts") never touches the SSH trust
anchor, and so that this repo pins the same host identity the API and
`cdcf-website` deploys already pin.

`VPS_HOST_KEY` must contain an entry matching `VPS_HOST` verbatim — the workflow
asserts this with `ssh-keygen -F` before connecting, because
`StrictHostKeyChecking=yes` otherwise turns a missing entry into an opaque
connection failure three retries deep. Because `VPS_HOST` is
`catholicdigitalcommons.org`, the API repo's existing pin covers it as-is.

### 6.1 The deploy keypair

One keypair per repository, never shared with the API or `cdcf-website` deploys:
a leaked key should cost exactly one subscription, and revoking it should not
take the other two deploys down with it.

Generated 2026-08-02, `ED25519`, no passphrase (unattended CI cannot unlock one):

```
SHA256:UGmdGlcJaz17APQQHf1gYpKb7TCWD/lkLYpuvNTkung
```

The private half is `~/.ssh/martyrology-frontend-deploy` on the operator
machine and the value of `secrets.VPS_SSH_KEY`. The public half is installed in
the subscription user's `authorized_keys` prefixed with OpenSSH's `restrict`
option, which disables port forwarding, agent forwarding, X11 forwarding and
pty allocation. The deploy needs none of them: `scp` and a non-interactive
`ssh <host> "tar ..."` both work without a pty. That turns a leaked key from
"a shell and a tunnel into the network" into "overwrite this one vhost".

A forced `command=` wrapper would narrow it further, but the deploy legitimately
needs two different remote operations (SFTP for the upload, `tar`/`touch` for
the activation), so the wrapper would have to parse `$SSH_ORIGINAL_COMMAND` —
new attacker-facing parsing code on the VPS in exchange for a marginal gain.
Rejected on the same reasoning the API's design used to keep its sudoers
drop-in to two literal commands with no wildcards.

No SSHFP drift check is included: `romanmartyrology.com` publishes no SSHFP
records, so the API's check would emit a "skipping" warning on every run and
train the reader to ignore it. Publish SSHFP for the domain and the API's
implementation can be lifted across verbatim.

## 7. Operator runbook

1. **Plesk → Domains → romanmartyrology.com → Node.js**, and configure:
   - *Node.js version*: 24 (match `.nvmrc`; the bundle's `node_modules` is
     built against it)
   - *Application Root*: `/httpdocs`
   - *Document Root*: `/httpdocs/public` — **not** the application root; see
     below
   - *Application Startup File*: `server.js`
   - *Application Mode*: `production`
   - *Custom environment variables*: `API_BASE` → `http://127.0.0.1:<port>`
   - then press **Enable Node.js**

   Do **not** press "NPM install" — the bundle ships its own `node_modules`.

   **"Enable Node.js" is a separate action from filling the form in.** Setting
   every field above and navigating away leaves the domain served as plain
   static hosting, which presents as the site "not deploying" when in fact it
   deployed perfectly and nothing is running it.

   **Application Root and Document Root are different things, and the
   difference matters.** Application Root is where Passenger looks for
   `server.js` and `tmp/restart.txt`. Document Root is where *nginx* looks for
   static files to serve itself, before handing anything to Passenger. Pointing
   the latter at `/httpdocs/public` does two useful things:

   - It matches Next's own contract, in which `public/x.json` is served at
     `/x.json`. nginx then answers those from disk without waking Node —
     confirmed live by `/changesets/index.json` returning `accept-ranges: bytes`
     and an inode-style etag with no Passenger header, while `/` and `/compare`
     return `x-powered-by: Next.js, Phusion Passenger`.
   - It structurally removes the placeholder-shadowing problem below, rather
     than papering over one instance of it.

   The trade-off to remember: anything in `public/` shadows an application route
   of the same name, because nginx resolves it first.

   **Why the document root must not be the application root.** A fresh Plesk
   subscription ships an `index.html` placeholder in `/httpdocs`. If that is
   also the document root, nginx serves it for `/` and permanently shadows the
   application's home page. The symptom is not an error: `GET /` returns a
   healthy **200** of the wrong page, so a deploy validated only against the
   home page would report success while serving Plesk's placeholder to every
   visitor. Observed exactly that way on the first deploy run, 2026-08-02, with
   `/` returning `<title>Domain Default page</title>`. With the document root at
   `/httpdocs/public`, the placeholder is simply outside it and harmless.

   This is the concrete justification for a choice §"Smoke test" previously
   argued only in the abstract: the deploy asserts the API proxy route because a
   200 on `/` demonstrably does not mean the application is serving.
2. Read the API's live port: `grep MARTYROLOGY_PORT /opt/martyrology/config/runtime.env`.
3. Enable SSH for the subscription: **Plesk → Websites & Domains →
   romanmartyrology.com → Web Hosting Access → Access to the server over SSH**.
   If this is *Forbidden*, sshd rejects the key before `authorized_keys` is ever
   consulted, and the deploy fails with a bare "Permission denied (publickey)"
   that looks identical to a wrong key.
4. Generate the keypair (§6.1) and install the public half. As root on the VPS,
   deriving the home directory from `/etc/passwd` rather than assuming it —
   sshd reads `authorized_keys` from that path *before* chrooting, so it is the
   real filesystem path, not the chroot-relative one:

   ```bash
   SUBUSER='<the secrets.VPS_USERNAME value>'
   PUBKEY='ssh-ed25519 AAAA... martyrology-frontend deploy (GitHub Actions)'

   HOME_DIR=$(getent passwd "$SUBUSER" | cut -d: -f6)
   GROUP=$(id -gn "$SUBUSER")
   echo "installing into $HOME_DIR/.ssh/authorized_keys"

   sudo install -d -m 700 -o "$SUBUSER" -g "$GROUP" "$HOME_DIR/.ssh"
   printf 'restrict %s\n' "$PUBKEY" | sudo tee -a "$HOME_DIR/.ssh/authorized_keys" >/dev/null
   sudo chown "$SUBUSER:$GROUP" "$HOME_DIR/.ssh/authorized_keys"
   sudo chmod 600 "$HOME_DIR/.ssh/authorized_keys"
   ```

   The append goes through `sudo tee` rather than `sudo ... >> file` on purpose.
   A `>>` redirect is performed by the *calling* shell, not by sudo, so it opens
   the file with the caller's privileges and fails against the 700-mode `.ssh`
   the previous line just created — "Permission denied" on a directory the same
   block appeared to create successfully. (Encountered for real on 2026-08-02.)
   Running the whole block inside `sudo -i` avoids it equally well.

   Verify — expect exactly `1`, and `.ssh` 700 / `authorized_keys` 600 owned by
   the subscription user:

   ```bash
   sudo grep -c 'martyrology-frontend deploy' "$HOME_DIR/.ssh/authorized_keys"
   sudo ls -ld "$HOME_DIR" "$HOME_DIR/.ssh" "$HOME_DIR/.ssh/authorized_keys"
   ```

   sshd's `StrictModes` additionally requires `$HOME_DIR` itself not be group- or
   world-writable. Plesk's default vhost mode satisfies this; if the key is
   refused with everything above correct, `ls -ld "$HOME_DIR"` is the first
   thing to check, and `/var/log/auth.log` states the reason outright.

   (Plesk's *SSH Keys Manager* extension does the same thing through the UI, if
   it is installed.)
5. Verify before handing the key to CI — this must print `AUTH_OK` and a `tar`
   path, which is also the §4 probe answered from the deploy's own vantage
   point:

   ```bash
   ssh -i ~/.ssh/martyrology-frontend-deploy \
       -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
       '<VPS_USERNAME>@catholicdigitalcommons.org' \
       'echo AUTH_OK; command -v tar gzip mkdir touch; ls -d /httpdocs'
   ```

6. Set the remaining repository secrets and variables from §6:
   ```bash
   gh secret set VPS_SSH_KEY -R CatholicOS/martyrology-frontend \
     < ~/.ssh/martyrology-frontend-deploy
   gh variable set API_BASE -R CatholicOS/martyrology-frontend \
     -b 'http://127.0.0.1:<MARTYROLOGY_PORT>'
   ```
7. Issue a Let's Encrypt certificate for the domain in Plesk if one is not
   already present — the smoke test requests `https://`.
8. Run `gh workflow run deploy.yml --ref main` to exercise the whole path
   before cutting a release.
9. Publish a release to deploy.

## 8. Out of scope

No staging environment (the API has none either; GitHub Actions Environments can
scope `VPS_APP_DIR` and `SITE_URL` per environment later). No blue/green. No
authentication on the frontend, and therefore no access to restricted 2004 text
(§3). No CDN. No frontend health endpoint — the smoke test uses
`/api/mr/editions`, which exercises strictly more of the chain than a
self-reported health check would.
