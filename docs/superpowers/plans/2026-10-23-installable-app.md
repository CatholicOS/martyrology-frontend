# Installable App (PWA, install only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make romanmartyrology.com installable as an app (install only, no service worker), with the Good Shepherd icon set, a favicon, and the icon's CC BY-SA credit.

**Architecture:** One Latin manifest from `app/manifest.ts` (Next's file convention, linked automatically). The icons are generated once by a hand-run `sharp` script from a committed master SVG and committed as PNGs. Apple and theme-colour metadata go in the locale layout. The licence credit goes next to the master and on the "Data and sources" docs page in all six languages.

**Tech Stack:** Next.js 16 (App Router, metadata file conventions), TypeScript, sharp ^0.35, vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-installable-app-design.md`

## Global Constraints

- No service worker, no install button or banner, no caching, no notifications.
- Palette: field `#5e0f12`, deep stone `#a98d6c`, warm stone `#d8c2a2`, parchment `#f7f1e6`.
- Manifest: `id "/"`, `name "Martyrologium Romanum"`, `short_name "Martyrologium"`, `lang "la"`, no `description`, `start_url "/"`, `scope "/"`, `display "standalone"`, `background_color "#5e0f12"`, `theme_color "#ffffff"`.
- Icon files: `public/icons/icon-192.png`, `public/icons/icon-512.png` (purpose `any`, rounded square, corner radius 22% of the side, transparent outside); `public/icons/maskable-192.png`, `public/icons/maskable-512.png` (purpose `maskable`, full `#5e0f12` square, the statue wholly inside the centred circle of 80% diameter); `app/apple-icon.png` (180, full bleed, opaque); `app/icon.png` (32, head-and-lamb crop); `app/favicon.ico` (16 + 32, same crop).
- Credit: photo "Marble statue of The Good Shepherd from the Catacombs of Domitilla, Vatican Museums" by Carole Raddato, CC BY-SA 2.0, https://www.flickr.com/photos/carolemage/32143459745 and https://commons.wikimedia.org/wiki/File:Marble_statue_of_The_Good_Shepherd_from_the_Catacombs_of_Domitilla,_Vatican_Museums.jpg. The icon artwork is CC BY-SA 2.0.
- `design/` and `scripts/build-icons.mjs` stay out of the Docker image. No test imports `scripts/build-icons.mjs` (the build type-checks tests, and `.dockerignore` excludes it).
- Tests that use `sharp` or `fs` start with `// @vitest-environment node` (the suite's default environment is jsdom).

## Review Focus

1. **A transparent or off-colour pixel at the maskable edge.** Anti-aliasing at the scaled statue's edge could leave a non-field ring outside the safe circle. Task 1's safe-zone test checks every pixel outside radius 0.4 × 512 against `#5e0f12`, within a tolerance of 8 per channel.
2. **The apple icon with an alpha channel.** iOS renders transparency as black. Task 1 asserts that `apple-icon.png` has no transparent pixel.
3. **`/manifest.webmanifest` or `/icons/*` caught by the locale proxy.** The proxy matcher skips paths with a dot. Task 2 adds a proxy test that `/manifest.webmanifest` and `/icons/icon-192.png` are not redirected.
4. **The credit missing in a language.** Task 3 checks all six `data.mdx` files.
5. **Icon paths in the manifest drifting from the files.** Task 2 checks that every manifest `src` exists under `public/`.

---

### Task 1: The icon master, generator and generated icons

**Files:**
- Create: `design/icon/good-shepherd.svg` (copy of `/tmp/claude-1000/-home-johnrdorazio-development-CatholicOS-org-crmedr/7badca3b-cc23-448a-bb67-01fe5c9fb88d/scratchpad/good-shepherd-master.svg`, plus `<title>Good Shepherd</title>` and a `<desc>` carrying the credit line from Global Constraints, as the first children of `<svg>`)
- Create: `design/icon/README.md` (source, photographer, both URLs, CC BY-SA 2.0, the changes made: traced to four flat colours, cleaned, hands redrawn from the photograph; how to regenerate: `npm run icons`)
- Create: `scripts/build-icons.mjs`; Modify: `package.json` (script `"icons": "node scripts/build-icons.mjs"`)
- Create (generated, committed): the seven icon files in Global Constraints
- Test: `lib/__tests__/icons.test.ts`

**Interfaces:**
- Produces: the files at the exact paths above. Task 2 references `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/maskable-192.png` and `/icons/maskable-512.png`.

- [ ] **Step 1: Write the failing test** `lib/__tests__/icons.test.ts` (node environment). It reads each file with `sharp(path).raw().ensureAlpha().toBuffer({ resolveWithObject: true })`:
  - `"each icon has its stated size"`: icon-192 → 192×192, icon-512 → 512, maskable-192 → 192, maskable-512 → 512, app/apple-icon.png → 180, app/icon.png → 32. Also `fs.existsSync("app/favicon.ico")`.
  - `"any icons have transparent corners"`: pixel (0,0) alpha is 0 in icon-192 and icon-512.
  - `"maskable and apple icons are opaque"`: every alpha in maskable-512 and apple-icon is 255.
  - `"maskable statue stays inside the safe zone"`: in maskable-512, every pixel whose distance from (256,256) is greater than 0.4 × 512 is within 8 per channel of (0x5e, 0x0f, 0x12).
  - `"maskable icon is not just a field"`: more than 20% of the pixels inside the circle differ from the field colour. This guards against a scale of 0.
- [ ] **Step 2: Run it.** `npx vitest run lib/__tests__/icons.test.ts`. Expected: FAIL, because the files are missing.
- [ ] **Step 3: Write the master and README, and implement `scripts/build-icons.mjs`.** Named constants at the top: `MASTER = "design/icon/good-shepherd.svg"`, `FIELD = "#5e0f12"`, `CORNER = 0.22`, `MASKABLE_SCALE` (the largest value that passes the safe-zone test; start around 0.72 and tune by running the test), and `FAVICON_CROP = { left, top, width, height }`, a square in master pixels framing the shepherd's head and the lamb's raised head (look at the 1200 px render, roughly x 380–1000, y 60–620). Render the master once at 1024 px with `sharp(MASTER, { density })`. Then:
  - `any` icons: resize, then composite an SVG rounded-rect mask with `blend: "dest-in"`.
  - `maskable`: resize to `round(size × MASKABLE_SCALE)`, centred on a `FIELD` square.
  - `apple-icon`: resize to 180 and `flatten({ background: FIELD })`.
  - `icon.png`: extract `FAVICON_CROP` from a 1200 px render and resize to 32.
  - `favicon.ico`: write the ICO container by hand (6-byte header plus a 16-byte directory entry per image, each image stored as PNG data, which ICO allows) holding the crop at 16 and 32. No new dependency.
- [ ] **Step 4: Generate the icons, then run the tests.** `npm run icons && npx vitest run lib/__tests__/icons.test.ts`. Expected: PASS. Then view `public/icons/maskable-512.png`, `app/icon.png` scaled up, and `public/icons/icon-512.png` with the Read tool, to check by eye that the crop frames the head and the lamb's head.
- [ ] **Step 5: Commit.** `git add design/icon scripts/build-icons.mjs package.json public/icons app/icon.png app/apple-icon.png app/favicon.ico lib/__tests__/icons.test.ts && git commit -m "icons: Good Shepherd icon set from one master"`

### Task 2: The manifest and the app metadata

**Files:**
- Create: `app/manifest.ts`
- Modify: `app/[locale]/layout.tsx` (`generateMetadata` and a new `viewport` export)
- Test: `lib/__tests__/manifest.test.ts`, `__tests__/proxy.test.ts` (extend)

**Interfaces:**
- Consumes: the four `public/icons` paths from Task 1.
- Produces: `export default function manifest(): MetadataRoute.Manifest` and `export const viewport: Viewport`.

- [ ] **Step 1: Write the failing tests.**
  - `lib/__tests__/manifest.test.ts` (node environment):
    - `"manifest has the Latin app identity"`: `manifest()` matches every Global Constraints manifest value, and `"description" in m` is false.
    - `"manifest lists the four icons"`: four entries, with `sizes` "192x192"/"512x512", `type: "image/png"`, `purpose` "any" ×2 and "maskable" ×2.
    - `"every icon exists"`: `fs.existsSync("public" + src)` for each.
  - `__tests__/proxy.test.ts`: `"leaves the manifest and icons alone"`. The exported `config.matcher` regex (built the way the existing tests use it) does not match `/manifest.webmanifest` or `/icons/icon-192.png`. If the existing tests call `proxy()` instead, assert that no redirect is returned for those paths.
  - The layout: in the existing layout or metadata tests, if there are any, or in `lib/__tests__/manifest.test.ts`, import `{ viewport }` from `@/app/[locale]/layout` and assert `themeColor` equals `[{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#020617" }]`. If importing the layout pulls in fonts that vitest cannot load, move `viewport` and the `appleWebApp` object into `lib/app-metadata.ts` (`export const appViewport: Viewport`, `export const appleWebApp`), re-export from the layout, and test that module instead. Record a ruling if you do.
- [ ] **Step 2: Run them.** `npx vitest run lib/__tests__/manifest.test.ts __tests__/proxy.test.ts`. Expected: FAIL on the missing module and the missing export. The proxy test may pass immediately, because the matcher already skips dotted paths; that's acceptable, since it pins existing behaviour (note it in the report).
- [ ] **Step 3: Implement.**
  - `app/manifest.ts` with the Global Constraints values.
  - In the layout: `generateMetadata` adds `appleWebApp: { capable: true, title: "Martyrologium", statusBarStyle: "default" }`, and `export const viewport` carries the theme colours above.
- [ ] **Step 4: Run the tests and the type check.** `npx vitest run && npx tsc --noEmit && npx eslint .`. Expected: all pass. Then run `npm run build` and confirm `.next/server/app/manifest.webmanifest*` exists in the build output.
- [ ] **Step 5: Commit.** `git add app/manifest.ts "app/[locale]/layout.tsx" lib __tests__ && git commit -m "app: installable manifest (Martyrologium Romanum) and theme colour"`

### Task 3: The icon credit in the docs

**Files:**
- Modify: `content/docs/{en,it,fr,de,es,pt}/data.mdx` (a new final section)
- Test: `lib/__tests__/docs-credit.test.ts`

- [ ] **Step 1: Write the failing test** (node environment). `"every language credits the icon photograph"`: for each of the six files, the content contains `Carole Raddato`, `CC BY-SA 2.0`, `https://creativecommons.org/licenses/by-sa/2.0/` and `flickr.com/photos/carolemage/32143459745`.
- [ ] **Step 2: Run it.** `npx vitest run lib/__tests__/docs-credit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the section to each page.** The heading is "## The icon" in English, translated in each language in the style of that page's other headings. Two or three sentences:
  - The icon shows the Good Shepherd of the Catacombs of Domitilla (Vatican Museums).
  - It is drawn from a photograph by Carole Raddato (linked to the Flickr URL), licensed CC BY-SA 2.0 (linked to the licence).
  - The icon is therefore under the same licence.
- [ ] **Step 4: Run the whole suite.** `npx vitest run`. Expected: all pass.
- [ ] **Step 5: Commit.** `git add content/docs lib/__tests__/docs-credit.test.ts && git commit -m "docs: credit the icon photograph (CC BY-SA 2.0)"`

### After the tasks

Push the branch and open the PR. Its description carries the spec's manual checklist, unticked, for after the deploy:
- DevTools → Application → Manifest shows no installability errors.
- The app installs on Android and on desktop.
- After installing, switching language shows no rename prompt and the app reopens in the last picked language.
- The app can be added to an iPhone's home screen with the right icon and the label "Martyrologium".
