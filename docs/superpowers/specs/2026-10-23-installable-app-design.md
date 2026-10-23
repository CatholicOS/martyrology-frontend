# Installable app (PWA, install only): design

## Intent

Readers who come back to the Martyrology every day should be able to put it on their phone's home screen or in their computer's app launcher, and open it in its own window, as an app. The app opens on the home page in the language the reader last picked, exactly as the site does today.

This is **install only**. The app is the live site in its own window. It has no offline reading and no caching, and it never sends notifications. It needs a network connection exactly as the site does.

## Goals

- Chrome, Edge and Samsung Internet on Android and desktop offer to install the site. Safari on iOS and iPadOS adds it to the home screen with the right icon and name ("Share → Add to Home Screen"), and Safari on macOS does the same with "Add to Dock".
- The installed app has the new Good Shepherd icon and the Latin name *Martyrologium Romanum*, the same in every language, and opens without browser chrome (`standalone`).
- The site gets a favicon. It has none today: `public/` is empty and `app/` has no icon file.
- The icon's artwork is credited as its licence requires (see Licence).

## Non-goals

- No service worker, and so no offline pages and no caching. Current Chrome and Edge no longer need one to install a site. This is my call: a browser that still requires one simply won't offer installation, and adding a minimal service worker later would be a small change.
- No install button or banner of our own. The browsers' own install interfaces are enough.
- No push notifications, no background sync, no app-store packaging.

## Anti-goals

- Nothing must change for readers who don't install: no new prompts, no new requests on page load except the manifest and the icons.
- The app must never show stale texts. That is why there is no service worker, and why one must never cache pages if it is added later.

## The icon

**The artwork:** the Good Shepherd of the Catacombs of Domitilla (Vatican Museums), traced from a photograph. It shows the young shepherd with the lamb across his shoulders and his fists holding its legs, in four flat colours:

| Role | Colour |
|---|---|
| Field (background) | deep red `#5e0f12` |
| Darkest hollows | deep stone `#a98d6c` |
| Shadows | warm stone `#d8c2a2` |
| Light | parchment `#f7f1e6` |

**The master:** `clean2_snap.svg` from the brainstorm (1200×1200 viewBox, about 620 KB, full-bleed square: the field fills it and the statue sits on it). It is committed as `design/icon/good-shepherd.svg`, outside `public/` so it is never served. The user accepted it "for now". The icon may be revisited, so everything below is **generated** from the master by one script, and replacing the art means replacing one file and re-running it.

**The generator:** `scripts/build-icons.mjs`, run by hand (`npm run icons`) and not at build time. It uses `sharp`, already a dependency, and writes the files below, which are committed:

| File | Size | Use | Shape |
|---|---|---|---|
| `public/icons/icon-192.png`, `icon-512.png` | 192, 512 | manifest, `purpose: "any"` | the master in a rounded square (corner radius 22% of the side), transparent outside |
| `public/icons/maskable-192.png`, `maskable-512.png` | 192, 512 | manifest, `purpose: "maskable"` (Android adaptive icons) | the master scaled down and centred on a full deep-red square, so the whole statue lies inside the safe zone (the centred circle of 80% diameter) |
| `app/apple-icon.png` | 180 | iOS and iPadOS home screen, via Next's file convention | the master full-bleed, square, no transparency (iOS rounds it itself) |
| `app/icon.png` | 32 | browser tab favicon, via Next's file convention | a crop of the master to the shepherd's head and the lamb's head (my call; see below) |
| `app/favicon.ico` | 16 + 32 | legacy `/favicon.ico` requests | the same crop |

**The maskable scale** isn't fixed by this design. The builder picks the largest scale at which no non-field pixel falls outside the 80% circle. A test checks this by looking at the 512 px file (see Tests).

**The favicon crop** is my call. At 16–32 px the whole statue turns into texture, and the head with the lamb's raised head is the most recognisable part. It's provisional, like the art itself. The crop rectangle lives in the generator as a named constant, so it's easy to change.

## The manifest: one, in Latin

**Decided by the user:** the app is one app in every language, with a language-neutral Latin name. Its language follows the reader's pick in the language menu, as on the site.

Why: Chromium treats every manifest with the same `id` as one installed app and re-reads the manifest of whatever page is open. With a manifest per language, switching language inside the app would rename it, with a confirmation dialog Chrome shows the reader, and would change the language it opens in. A single neutral manifest avoids both.

**The route:** `app/manifest.ts`, Next's file convention. It is served at `/manifest.webmanifest`, and Next links it from every page by itself. It is static: no locale, no messages.

| Field | Value |
|---|---|
| `id` | `"/"` |
| `name` | `"Martyrologium Romanum"` |
| `short_name` | `"Martyrologium"` (the home-screen label) |
| `lang` | `"la"` |
| `description` | omitted, since a description in one language would contradict the neutral name (my call) |
| `start_url` | `"/"`. The proxy redirects it to the language in the `NEXT_LOCALE` cookie (written only by the language picker); without one it follows `Accept-Language`, else English |
| `scope` | `"/"` |
| `display` | `standalone` |
| `background_color` | `#5e0f12` (the splash screen shows the icon on its own field) |
| `theme_color` | `#ffffff` (the window's title bar matches the site's white header) |
| `icons` | the four `public/icons` files above, with `sizes`, `type: "image/png"` and their `purpose` |

**Theme colour in the page:** the layout exports `viewport.themeColor` with two entries, white for `(prefers-color-scheme: light)` and `#020617` (slate-950, the site's dark background) for `(prefers-color-scheme: dark)`. The title bar then follows the reader's theme, where the browser supports it.

**Apple:** `generateMetadata` adds `appleWebApp: { capable: true, title: "Martyrologium", statusBarStyle: "default" }`.

## Licence

The photograph traced is "Marble statue of The Good Shepherd from the Catacombs of Domitilla, Vatican Museums" by Carole Raddato, on Wikimedia Commons from Flickr, licensed **CC BY-SA 2.0**. The statue itself is in the public domain. The icon is a derivative of the photograph, so:

- The icon artwork (the master and every generated file) is licensed **CC BY-SA 2.0**, with credit to the photographer.
- `design/icon/README.md` says so. It gives the source URL (https://www.flickr.com/photos/carolemage/32143459745 and the Commons file page), the licence and a summary of the changes made (traced to four flat colours, cleaned, hands redrawn from the photograph).
- The docs page "Data and sources" (`content/docs/<lang>/data.mdx`, all six languages) gets a short "Icon" section with the same credit and licence, linked.
- The master SVG carries the credit in a `<title>`/`<desc>` or `<metadata>` element. The generated PNGs need not.

## Tests

The project's vitest suite:
- **The manifest:** `app/manifest.ts`'s default export has the values in the table above, and every icon path it lists exists in `public/`.
- **The icon files:** every generated file exists at its stated pixel size (read with `sharp`). `icon-*` have transparent corners, `maskable-*` and `apple-icon` have none.
- **The maskable safe zone:** in `maskable-512.png`, every pixel outside the centred circle of radius 0.4 × 512 is the field colour `#5e0f12`, within a small tolerance for anti-aliasing.

**By hand, after the deploy:** Chrome's DevTools (Application → Manifest) shows no installability errors; after installing, switching language inside the app shows no rename prompt and the app reopens in the last picked language; the app installs on Android and on desktop; it is added to the home screen on an iPhone. The checklist goes in the PR.

**The deploy image:** `.dockerignore` admits `public/` and `app/` and leaves out `design/` and `scripts/` (apart from two listed scripts). The build type-checks the tests, so the icon tests read the generated files with `sharp` and never import `scripts/build-icons.mjs`.

## Left to the builder

- The generator's internals and its exact `npm` script name.
- The favicon crop rectangle and the maskable scale, within the rules above.
- Whether the docs credit goes at the end of "Data and sources" or after "The registry". Its wording in the five other languages follows the existing pages' style.
