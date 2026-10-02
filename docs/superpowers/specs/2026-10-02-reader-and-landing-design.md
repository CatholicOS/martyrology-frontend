# Reader and landing page — design

**Status:** approved in brainstorming 2026-10-02; spec under review.
**Repos:** `martyrology-frontend` (most of the work), `martyrology-api` (one new endpoint).
**Sub-project 1+2 of 4.** The full redesign was split into: (1+2) landing, reader
and the Review gate — this spec; (3) the two-books comparison view; (4) the map
view, which first needs crmedr and the API to publish place coordinates.

## Goal

Replace the current landing page — two links, "Compare editions" and "Review
change-set" — with a public reading experience. A visitor sees the editions of
the Roman Martyrology as books on a shelf and opens one at today's date. The
change-set review stops being a public option and becomes a back-office tool
for curators.

## Decisions taken

| Question | Decision |
|---|---|
| Landing | A bookshelf of editions, newest → oldest; opening a book lands on **today's** date, not 1 January. |
| Cover style | **Tooled leather**: dark red leather, gold title, gilt frame, drawn in code (no images). |
| Reading view | **Single page per day**, turned like a leaf, not a two-page spread. Sub-project 3 will put two such pages side by side. |
| Who sees `/review` | Users with Zitadel project role `admin` or `martyrology_editor`. Everyone else: no link, and 404. |
| How the shelf learns access | A new `martyrology-api` endpoint, `GET /api/v1/access`. |

## Current facts this design rests on

- `GET /api/v1/editions` lists 8 editions with `edition_id`, `year`, `locale`,
  `nature` and `availability.status` (`public` | `restricted-texts` |
  `unavailable`). `availability.status` is the same for every caller: it says
  an edition *is* restricted, not whether *this* caller may read it.
- Texts exist for 1749 (all year), 1914 English (January and February only)
  and the three 2004 editions (restricted). 1584, 1914 Latin and 2001 are
  `unavailable`: registered but no texts loaded.
- `GET /api/v1/elogia/edition/{id}/{mm}/{dd}` returns `titulus`, `elogia[]`
  (each: `id`, `entry`, `asterisk`, `unnumbered`, `anchor_day`, `text`) in
  printed order, `conclusio`, and `metadata.access` / `metadata.access_info`
  when the caller is denied. A denied caller gets `text: null`, not an error.
  A day with no entries is a 404.
- An invalid or expired bearer token is a 401 from the API, never a silent
  fallback to anonymous. The frontend proxy (`/api/mr`) already refreshes
  tokens and sends expired sessions anonymously.
- Zitadel's ID token carries `urn:zitadel:iam:org:project:roles` for this
  project without requesting an `:aud` scope (verified in production,
  `cdcf-infra/auth/handoffs/martyrology.md`, "Verified end to end — 2026-08-03").
- The frontend session exposes only `user` and `error`; the access token never
  reaches the Session (guarded by `lib/__tests__/auth-callbacks.test.ts`).

## 1. Routes and structure

| Route | Who | What |
|---|---|---|
| `/` | everyone | The bookshelf. |
| `/read/[edition]` | everyone | Client-side redirect to `/read/[edition]/[mm]/[dd]` for today in the reader's local time (the server cannot know the reader's timezone). |
| `/read/[edition]/[mm]/[dd]` | everyone | The reader: one page per day; a shareable URL. |
| `/compare` | everyone | Unchanged until sub-project 3 replaces it. |
| `/review` | curators only | Server-side gate; 404 for everyone else. |

**Header** (`SiteHeader`): "Martyrology", linking to `/`, on the left. On the
right: **Compare**, **Review** (curators only), and the existing Sign in / Sign
out control.

**Data fetching** stays client-side through `/api/mr`, as `/compare` does
today. That is the path that forwards and refreshes the session token (see
`lib/session-token.ts`). Server rendering the public 1749 pages for search
engines is out of scope.

## 2. The bookshelf (`/`)

**Order:** newest year first. Within a year: the Latin original (`nature`
starting with `editio_typica`) first, then `editio_vernacula`, then
`translatio`. The resulting shelf is 2004 Latin, 2004 Italian, 2004 English,
2001, 1914 Latin, 1914 English, 1749, 1584.

**Cover:** a tooled-leather book drawn with CSS:
- a dark red spine band, a red leather face and a thin gilt frame;
- a gold title by language: `la` → "MARTYROLOGIUM ROMANUM", `it*` → "MARTIROLOGIO
  ROMANO", `en` → "ROMAN MARTYROLOGY";
- the year at the foot of the cover;
- the language under the book ("Latin", "Italiano (CEI)", "English").

Titles live in a small frontend table keyed by locale, since the API has no
title field.

**State:** each book has one of three states.
- **unavailable** if `availability.status` is `unavailable`;
- otherwise **open** if `/access` says `can_read_texts: true`;
- otherwise **locked**.

| State | Look | Hover | Click |
|---|---|---|---|
| open | red (Latin originals) or dark red (translations and vernacular editions) | tilts slightly, as if inviting you to open it | the cover swings open (a short 3D rotation), then navigates to `/read/[edition]` |
| locked | grey-red with 🔒 | tilts | a message on the shelf. Signed out: "Sign in to open this edition" with a Sign in button. Signed in without rights: "Your account doesn't have access to this edition", plus the API's `access_info` link when one is provided. |
| unavailable | dashed outline, muted | none | nothing; the label reads "not yet available" |

**Motion:** with `prefers-reduced-motion`, there is no tilt and no swing; a
click navigates straight away.

**Loading and errors:** placeholders shaped like books while `/editions` and
`/access` load. If `/editions` fails, show an error with a Retry button. If
only `/access` fails, show every non-unavailable book as open: the API redacts
anyway, and the reader then shows the locked state.

## 3. The reader (`/read/[edition]/[mm]/[dd]`)

**Data:** one `GET /elogia/edition/{id}/{mm}/{dd}` per page.

**Typesetting:** a cream page, a serif body face, and the rubrics in red.
- **Red rubrics:** the day heading (the `titulus`, with the day as a large
  first line), each eulogy's printed number with its asterisk where the
  edition prints one, and the "R." of the conclusion.
- **Unnumbered** entries (headers such as "Festum sanctorum Angelorum
  Custodum") are centred and in italics.
- The **conclusio** closes the page in italics.
- The canonical ID is not shown in the reader.

**Top bar:**
- a month picker;
- a day picker listing that month's days, with 29 February always included;
- **Today**;
- **Switch book**, a menu of the editions the user can open that keeps the
  current date;
- "⟵ Shelf".

**Turning pages:**
- arrows at the left and right edges of the page, ← and → on the keyboard, and
  a horizontal swipe on touch screens;
- 31 December turns to 1 January, and 1 January back to 31 December;
- a page-turn animation, reduced to a fade with `prefers-reduced-motion`;
- each turn pushes the new URL, so Back and Forward work.

**States:**
- **Loading:** a page outline.
- **Locked:** `metadata.access === "restricted-texts"`, for example when a
  locked edition is opened by URL. Show the same message as the shelf, never
  a page of null texts.
- **No text for this day:** the API returns 404. "This edition has no text for
  2 October", with the controls still working.
- **Unknown edition, or invalid `mm`/`dd`:** a 404 page.
- **API unreachable:** the proxy returns 502. An error message with a Retry
  button.

## 4. Access endpoint and the Review gate

### `GET /api/v1/access` (martyrology-api)

```json
{"editions": {"martyrologium_romanum_1749": {"can_read_texts": true},
              "martyrologium_romanum_2004": {"can_read_texts": false}, "...": {}}}
```

- **Coverage:** every edition `/editions` lists.
- **Value:** the existing `texts_allowed(request, identity, edition_id)`.
  Public editions are always `true`. Restricted editions run the OpenFGA
  `can_read_texts` check for the caller's identity. Anonymous callers get
  `true` for public editions only.
- **Auth:** the same `get_identity` dependency as the read routes, so a bad or
  expired token is a 401.
- **Caching:** the response is `Cache-Control: private`, because it depends on
  the caller. `/editions` stays shared-cacheable and unchanged.
- **Frontend:** `getAccess()` in `lib/api.ts`. Sub-project 3 reuses it.

### The `curator` flag and `/review`

- **Reading the role:** at sign-in (the `jwt` callback with `account` and
  `profile` present), read the roles claim `urn:zitadel:iam:org:project:roles`
  from the ID-token profile. Store `curator: boolean` on the JWT, where a
  curator holds `admin` or `martyrology_editor`. A pure helper,
  `isCurator(rolesClaim)`, does the check. Zitadel sends the claim as an object
  keyed by role name (`{"admin": {"<orgId>": "<domain>"}}`), so the helper
  tests the keys, and a missing or malformed claim counts as not a curator.
- **Session:** the `session` callback adds `curator` (a boolean) and nothing
  else. It never adds the roles list or any token. The existing leak-guard
  test is extended to cover this.
- **The gate:** `app/review/page.tsx` becomes a server component. It calls
  `auth()` and runs `notFound()` unless `session.curator`. The current client
  review UI moves unchanged into `components/ReviewPage.tsx`.
- **Header:** the Review link is rendered only for curators.
- **Limits, stated plainly:**
  - Roles are read at sign-in. A newly granted role takes effect after signing
    out and back in.
  - The gate hides the review *tool*, not its data. The change-set files under
    `/changesets/` stay publicly fetchable. They come from crmedr, a public
    repository, and the review page performs no API writes: decisions are
    exported locally.

## 5. Units

**Frontend:**
- `lib/editions.ts` (pure): `editionTitle(edition)`, `languageLabel(edition)`,
  `sortForShelf(editions)` and `shelfState(edition, access)`.
- `lib/calendar.ts` (pure): `daysInMonth(mm)` (February has 29),
  `nextDay`/`prevDay` with wrap-around, `todayLocal()`, and `parseDay(mm, dd)`
  for validation.
- `lib/roles.ts` (pure): `isCurator(rolesClaim)`.
- `components/BookCover.tsx` (presentational): one book in a given state.
- `components/Bookshelf.tsx`: fetches editions and access, sorts them, and
  handles clicks and the locked message. It takes `signedIn: boolean` as a
  prop from `app/page.tsx`, a server component that calls `auth()`, to choose
  the locked message. There is no client session provider.
- `components/DayPage.tsx` (presentational): typesets one day's API data.
- `components/ReaderBar.tsx`: the pickers, Today, Switch book and Shelf.
- `components/Reader.tsx`: fetching, page turning and the states. It also
  fetches `/editions` and `/access` once, for Switch book and the edition
  header, and takes `signedIn` from its server page for the locked message.
- `components/ReviewPage.tsx`: the moved review UI.
- `app/page.tsx`, `app/read/[edition]/page.tsx`,
  `app/read/[edition]/[mm]/[dd]/page.tsx` and `app/review/page.tsx` (the gate).
- `auth.ts`, `types/next-auth.d.ts` and `components/SiteHeader.tsx`: changed.

**martyrology-api:** `routers/access.py` (or the route added to the existing
discovery router, following that repo's conventions), plus its tests.

## 6. Testing

- **Unit:**
  - `lib/calendar.ts`: 29 February, the 31 December ↔ 1 January wrap, invalid
    `mm`/`dd`.
  - `lib/editions.ts`: sorting, titles and labels, every `shelfState`
    combination.
  - `isCurator`: absent claim, other roles, `admin`, `martyrology_editor`.
- **Component:**
  - `BookCover` in each state, including that unavailable is not clickable.
  - `DayPage`: numbers, asterisks, unnumbered headers, the conclusion's "R.".
  - `Reader`: the locked, no-text, error and loading states, with the API
    mocked.
  - `Bookshelf`: the signed-out and no-access locked messages.
- **Security:**
  - The leak guard: the session carries `curator` (a boolean) and no token or
    roles list.
  - `/review` gate: `notFound()` for a signed-out user and for a non-curator.
- **API (pytest):** `/access` for anonymous, authorized and unauthorized
  callers, with OpenFGA mocked, plus the `private` cache header. An invalid
  token gets a 401.
- **Manual, local stack:**
  - signed in as the root superuser: the 2004 books open and Review shows;
  - signed out: the 2004 books are locked, Review is hidden and `/review` is a 404.

## Out of scope

- **Sub-project 3:** the two-books comparison view.
- **Sub-project 4:** the map view and its data pipeline.
- **Other:**
  - server rendering for search engines;
  - photographed covers;
  - a "request access" workflow beyond linking `access_info`;
  - which day's eulogies to show as "today": the reader shows the calendar
    day, without the traditional practice of reading the next day's eulogies.
