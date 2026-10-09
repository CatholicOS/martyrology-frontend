# Persons and places marked up in the eulogies — design

**Status:** approved; amended during planning (see the end) · **Date:** 2026-10-09 ·
**Repos:** `crmedr`, `martyrology-api`, `martyrology-frontend`

## Purpose

The reader shows each eulogy as plain text. This feature marks the persons and places a eulogy names, much as
Wikipedia links names in its articles. A reader who turns on the markup sees each saint or blessed and each place
underlined, and on hover gets:

- for a **place**: its name in the website language and a small map;
- for a **person**: their name in the website language, their dates, a short description, a portrait and links to
  Wikipedia and Wikidata.

Persons not yet linked to Wikidata are marked too. The markup is a reading aid. It is also a way for curators to
check, by reading, what has been tagged wrongly and what has been missed.

## Scope

- **Editions:** the 2004 *editio typica altera* in Latin (`martyrologium_romanum_2004`) and its Italian edition
  (`martyrologium_romanum_2004_it_IT`). These are the only editions crmedr has data for. Others follow edition by
  edition, each with its own extraction and review in crmedr. That work is not part of this spec.
- **Persons:** the Latin edition only. crmedr's persons (`data/persons.json`) are extracted from the Latin text;
  the Italian edition has none.
- **Places:** both editions. crmedr's places (`data/places.json`) carry each eulogy's printed place in Latin (`la`)
  and in Italian (`it`).
- **Not in scope:** a database of suggestions and reviews from signed-in users (martyrology-api#125). The fixes this
  feature needs are change-set operations, so they will plug into that queue unchanged when it exists.

## What the data supports today

Measured on four months (January, April, July, October) of the 2004 texts:

| | Mentions | Matched |
|---|---|---|
| Places, Latin | 1,496 eulogies with a printed place | 1,481 verbatim. The 15 misses are all *Ibídem* (the place repeated from the eulogy before). |
| Places, Italian | 1,495 | 1,481 after folding accents. The misses are *Sempre a Londra*, *Ancora a Londra*. |
| Persons, Latin text | 1,850 | 282 verbatim (the stored name is the nominative, the text mostly a genitive), 1,453 more by stem match, 115 unmatched. |
| Persons, Latin footnotes | 372 | not measured |

Across the whole edition there are 6,478 person mentions. 1,019 of them (938 distinct people) have a Wikidata item
so far; the rest are in the persons review queue.

The unmatched persons are mostly names split by a parenthesis or a cognomen: "Nemæ Fictínæ (Nemæ Stellæ) Nemau",
"Nemárdi, cognoménto Fictóris", "Nemúti, cognoménto Fictárd".

## Architecture

```
crmedr (public, no text)                 martyrology-api                     martyrology-frontend
──────────────────────────               ───────────────                     ────────────────────
scripts/extract_mentions.py ──► data/mentions.json ──► loaded at start-up,  ──► elogia[].mentions ──► EulogyText marks
   reads the 2004 texts         data/mentions_curated    checked against the        (day / month)        (switch on)
                                                           text, served
scripts/person_details.py   ──► data/person_details.json ─────────────────────────► data snapshot ──► /api/entities
   cached Wikidata client                                                            (frontend)        (popup details)
```

- **crmedr** owns the mentions and their curation, as it owns persons and places. It stores character offsets and
  a fingerprint of the printed words (`check`), never the words themselves: the 2004 edition is copyrighted,
  crmedr is public, and its policy is that printed person forms are read but never stored.
- **martyrology-api** serves the mentions with each eulogy, after checking each one still lands on the words it
  names.
- **martyrology-frontend** draws them and fetches each item's details only for the day on screen.

## crmedr

### `data/mentions.json`

```jsonc
{
  "$comment": "…",
  "editions": {
    "martyrologium_romanum_2004": {
      "mr:0101-basilius": [
        { "kind": "place",  "where": "text", "start": 0,  "end": 21, "check": "…8 hex…", "qid": "Q48338" },
        { "kind": "person", "where": "text", "start": 46, "end": 53, "check": "…8 hex…", "name": "Basilius", "qid": null }
      ]
    },
    "martyrologium_romanum_2004_it_IT": { "…": [] }
  }
}
```

- `where` is `"text"` or `{ "footnote": n }`. For a footnote, `start` and `end` count from the start of that
  footnote's text.
- `start` and `end` are offsets in UTF-16 code units, the unit JavaScript strings use. Python counts code points, so
  the script converts. The difference shows only outside the Basic Multilingual Plane, which the eulogies don't
  use; the API's check catches it if one ever does.
- `check` is the first 8 lowercase hex digits of SHA-256 over the UTF-8 bytes of the text between `start` and
  `end`, exactly as printed. It lets the API confirm a span still lands on the same words without crmedr storing
  them.
- `name` (persons only) is the nominative in `persons.json`. It is the key that ties the mention to its person.
- `qid` is not decided here. It is copied from crmedr's own decisions: for a person, `person_items.json` (decided
  by `resolve_person`); for a place, `places.json` (decided by `resolve_place`). It is `null` while undecided.
  Changing a QID means changing that decision, never editing `mentions.json`, so there is one source of truth for
  each.
- A eulogy's mentions are sorted by `where` (text first, then footnotes in order), then by `start`.

### `scripts/extract_mentions.py`

`python3 scripts/extract_mentions.py /path/to/martyrology-texts`, standard library only, like `extract_persons.py`.

- **Places, both editions:**
  - Find the eulogy's printed form (`places.json`: `la` or `it`) in its text. Try an exact match first, then a match
    after folding accents and case. The span is taken from the original text, never the folded copy.
  - A eulogy whose text opens with *Ibídem* / *Ibidem* (Latin) or *Sempre a*, *Ancora a*, *Ivi* (Italian) followed
    by its place's name marks that phrase with the eulogy's place. For the Italian, the mark covers the place name
    too: "Sempre a Londra".
- **Persons, Latin only:** for each mention in `persons.json`, look in the text, or in footnote *n* when
  `where` is `{footnote: n}`:
  1. the name verbatim, after folding accents;
  2. otherwise each word of the name by its stem (the word less its last two letters, at least three letters long)
     as consecutive word prefixes;
  3. otherwise the same, allowing one parenthesis or `cognoménto` phrase between the words. The mark then covers
     from the first word to the last, parenthesis included.

  The match must start at a word that is not part of a longer known name already marked. A name found more than
  once in the same place marks the first occurrence that is not already taken.
- A mention that can't be located is left out of `mentions.json` and listed in `docs/mentions-report.md`.
- **Overlaps:** two mentions may not overlap. A person inside a place phrase ("in civitáte Sancti Ioánnis") is the
  case to expect: the place wins. The person is reported for review.
- **Curation:** `data/mentions_curated.json` holds, for each eulogy a curator has corrected, the eulogy's complete
  list of mentions in the same shape as `mentions.json`. It replaces the extraction for that eulogy, exactly as
  `persons_curated.json` does. QIDs are still copied from the persons and places decisions at output time.

### `data/person_details.json` and `scripts/person_details.py`

For each QID that a person mention links to, built with the existing cached client (`scripts/wikidata.py`):

```jsonc
{
  "Q19546": {
    "description": { "en": "Greek bishop and Doctor of the Church", "it": "…", "fr": "…", "de": "…", "es": "…", "pt": "…" },
    "born": "+0329",   // the year as Wikidata gives it, with its precision; null if unknown
    "died": "+0379",
    "image": { "file": "Basil of Caesarea.jpg", "author": "…", "license": "CC BY-SA 4.0", "license_url": "…" },
    "wikipedia": { "en": "Basil of Caesarea", "it": "Basilio di Cesarea", "…": "…" }
  }
}
```

- Descriptions and Wikipedia titles only for the six interface languages; a language without one is left out.
- `image` comes from P18. Its author and license come from Commons (`imageinfo`, `extmetadata`). A file whose license
  can't be read is left out, rather than shown without its credit.
- Dates use the existing `_date` helper, which keeps "circa" and century-level precision.
- Labels stay where they are: the frontend's persons snapshot already carries them.

### Change-set operations

Three operations are added to `crmedr-changeset/v1`, all about where a mention's words are:

```jsonc
{ "op": "add_mention", "id": "<edition>|<eulogy>|<where>|<start>", "edition": "…", "eulogy": "mr:…",
  "where": "text", "start": 46, "end": 53, "form": "Basilíi", "kind": "person", "name": "Basilius",
  "context": "…sancti Basilíi, magístri…", "reasoning": "…", "decision": null, "edited": null }
{ "op": "set_span", "id": "…", "edition": "…", "eulogy": "…", "where": "text",
  "from": { "start": 46, "end": 53 }, "to": { "start": 46, "end": 60, "form": "…" }, "…": "…" }
{ "op": "remove_mention", "id": "…", "edition": "…", "eulogy": "…", "where": "text",
  "start": 46, "end": 53, "form": "Basilíi", "reasoning": "…", "decision": null }
```

- `context` is a few words either side of the span, so a curator can decide without the full text. A change-set
  carrying `context` from the 2004 edition is never committed to the public frontend repo. It goes in the private
  change-set directory on the server (`CHANGESETS_DIR`), like the other change-sets that quote that edition.
- `edited` (when `decision` is `"edit"`) carries `{start, end, form}` for `add_mention` and `set_span`.
- Applying the accepted operations rewrites the affected eulogies in `mentions_curated.json`.
- `extract_mentions.py` writes `mentions-review.json`, a change-set for the cases it could not settle:
  - an `add_mention` for each unmatched person, with its best partial match, or with no span if there is none;
  - a `remove_mention` for each match it doubts: an overlap it gave to a place, or a stem match where several were
    possible.

## martyrology-api

- **Loading:** at start-up, the API reads `data/mentions.json` from the vendored crmedr (`vendor/crmedr`, refreshed
  with crmedr's release).
- **Checking:** for each mention, it takes the eulogy's text, or footnote *n*'s text, slices `text[start:end]`,
  counted in UTF-16 code units, and compares that slice's fingerprint with `check`.
  - A mention that doesn't match is dropped and logged once at start-up with its edition, eulogy, offsets and
    `check`. This happens when the text has been corrected since crmedr's extraction.
  - The count of dropped mentions is reported in the start-up log.
- **Serving:** each eulogy in the day, month and single-eulogy responses gains `mentions: Mention[]`, an empty list
  when there are none.
  - `Mention` carries `kind`, `where`, `start`, `end`, `form` (the slice, taken from the API's own text), `qid`,
    and `name` (`null` for places).
  - Mentions are left out whenever the text is: a locked edition for a reader without access gets
    `mentions: []`.
- **OpenAPI:** `Mention` is a schema, and the `mentions` field is documented with it.
- **Edition list:** nothing changes in it. A client learns an edition has markup by its eulogies carrying mentions.

## martyrology-frontend

### Data

- `scripts/snapshot-registry.mjs` copies `person_details.json` into `data/person-details-snapshot.json`, beside the
  persons and places snapshots.
- `lib/types.ts`: `ElogiumOut` and `Footnote` gain the mentions the API serves. The footnote's mentions are those
  with `where: {footnote: n}`, attached to it when the day's data is shaped.
- **`/api/entities?ids=Q1,Q2,…`**, a route handler:
  - it returns, for each QID: the labels in the six languages, then either the person details or the place's
    country and coordinates;
  - it reads the three snapshots on the server, so the reader never downloads them;
  - it caps a request at 200 IDs;
  - responses are `Cache-Control: public, max-age=3600`.
- **Fetching:** the reader asks for every QID on the day at once, the first time the switch is on for that day, and
  keeps the answer for the session.

### The switch

- `lib/use-show-ids.ts` becomes `lib/use-reader-switch.ts`, exporting `useReaderSwitch(key)`. `useShowIds` keeps its
  name as `useReaderSwitch("reader.showIds")`, so nothing else changes.
- A new switch, "Names & places" (`reader.markup`), goes in the reader bar beside "Show IDs". It uses the same
  `role="switch"` checkbox, is off by default, and is remembered in the browser.
- Off: `EulogyText`'s output is exactly what it is today.

### Marks in the text

- `EulogyText` and `PrintedFootnotes` take the mentions and the switch state. Mentions become one more set of cut
  points, alongside the misprint, erratum and footnote-mark positions the text is already split at.
- A mention cut by a footnote mark or by the edge of an erratum renders as several pieces. Each piece belongs to the
  same mention (`data-mention` holds its key) and opens the same popup.
- If two mentions overlap anyway (crmedr forbids it), the first one in the list wins, and the other is dropped with
  a console warning.
- **Look:**
  - persons: `text-decoration: underline dotted`;
  - places: `underline dashed`;
  - both: the text's own colour, with the line at about 60% opacity, a `text-underline-offset` of 0.2em, and
    `cursor: help`.
- **Hover tint:** on hover, focus or while its popup is pinned, every piece of the mention gets a soft background
  tint, warm for persons and cool for places, with values for dark mode.
  - In `forced-colors` mode, the tint is `Highlight` with `HighlightText`.
  - The tint fades in over 150 ms, or appears at once with `prefers-reduced-motion`.
- **Semantics:** the first piece of each mention is focusable (`tabindex="0"`, `role="button"`, `aria-haspopup="dialog"`,
  `aria-expanded`), so keyboard users meet each mention once. Its accessible name is the printed words; the kind is
  given by `aria-roledescription` ("person", "place", translated).

### Popups

- **One popup at a time**, in a portal:
  - placed beside the mention, below it by default, flipped above or shifted sideways to stay in the window;
  - repositioned on scroll and resize while open;
  - positioned from the mention's `getBoundingClientRect()`, without a positioning library.
- **Opening and closing:**
  - **Hover:** opens after about 300 ms, closes about 200 ms after the pointer leaves both mention and popup.
  - **Click or tap:** pins it open; a second click unpins.
  - **Keyboard:** Enter or Space on a focused mention pins it.
  - **Closing:** Escape, or a click outside, closes it and returns focus to the mention.
  - It is `role="dialog"` without `aria-modal`, labelled by its heading. Focus moves into it only when it was
    opened from the keyboard.
- **Person popup:**
  - **Heading:** the label in the website language, else English (`lang="en"`), else the Latin `name`
    (`lang="la"`).
  - **Dates:** birth and death years, formatted by the interface ("c. 329 – 379"; a century when that is all
    Wikidata has).
  - **Description:** in the website language, else English (`lang="en"`).
  - **Portrait:** a Commons thumbnail at 96 px wide (`upload.wikimedia.org` via `Special:FilePath?width=96`,
    `loading="lazy"`), loaded only when the popup opens. Under it, "Author · License", linked to the file's Commons
    page and the license.
  - **Links:** the Wikipedia article in the website language if there is one; Wikidata.
  - **Not linked to Wikidata:** the Latin name, "Not yet linked to Wikidata", and the eulogy's canonical ID.
- **Place popup:**
  - **Heading:** the label in the website language, else English (tagged), and the country.
  - **Printed form:** as the edition prints it, tagged with the edition's language.
  - **Map:** about 260 × 160 px, with the Esri street tiles the map page uses and a single marker.
    - Leaflet is imported the first time a place popup opens, so it never weighs on the reader otherwise.
    - Only the zoom buttons work. Dragging, scroll-wheel zoom and keyboard panning are off, so scrolling over the
      popup scrolls the page.
  - **Links:** "See on the map" (`/map?edition=…`) and Wikidata.
- **When details fail to load:** the popup shows the printed words and "Details unavailable", with a retry link. The
  marks never depend on `/api/entities`.
- **Translations:** every new string goes into all six message files. This covers the switch, its tooltip, the
  person and place role names, "Not yet linked to Wikidata", "See on the map", "Details unavailable" and the link
  names.

### `/review`

- `lib/changeset.ts` gains `AddMentionOp`, `SetSpanOp` and `RemoveMentionOp`.
- A `MentionCard` shows the operation's `context` with the span highlighted in its kind's tint: the current span
  struck through, the proposed one underlined.
  - Accept, reject and edit work as for the other cards.
  - Edit lets a curator set the span by selecting words in the context.
- The `mentions-review` change-set is bundled into the private change-set directory by `scripts/import-changeset.mjs`,
  like the persons review.

## Delivery

Four pull requests, in order. The reader feature (1–3) ships before the review cards (4). Until 4 lands, mentions
are fixed by editing `mentions_curated.json` in crmedr.

1. **crmedr:**
   - `extract_mentions.py`, `mentions.json`, `mentions_curated.json`, `docs/mentions-report.md`;
   - `person_details.py`, `person_details.json`;
   - the three change-set operations in the schema docs;
   - tests.
2. **martyrology-api:** re-vendor crmedr, load and check the mentions, `mentions` on eulogy responses, OpenAPI,
   tests.
3. **martyrology-frontend, the reader:**
   - the snapshot step and `/api/entities`;
   - `useReaderSwitch` and the switch;
   - the marks in `EulogyText` and `PrintedFootnotes`;
   - the two popups;
   - messages in six languages;
   - tests.
4. **martyrology-frontend, review:** the three operation types, `MentionCard`, bundling `mentions-review`.

## Testing

- **crmedr (unittest, short fixtures, no copyrighted text in the repo):**
  - the place found verbatim and after folding;
  - *Ibídem* and *Sempre a Londra*;
  - a genitive found by stem;
  - a name split by a parenthesis, and one split by `cognoménto`;
  - a "Maria" inside a Marian title that must not be marked;
  - a footnote mention, with its offsets counted from the footnote;
  - a person inside a place phrase (the place wins, the person reported);
  - UTF-16 offsets;
  - a curated eulogy kept through a re-run;
  - QIDs copied from the persons and places decisions.
- **martyrology-api:**
  - a valid mention is served on day, month and single-eulogy responses;
  - a stale mention (`check` no longer matches the text) is dropped and logged;
  - a footnote mention is checked against its footnote;
  - a locked edition gets `mentions: []`;
  - the OpenAPI document has the `Mention` schema.
- **martyrology-frontend (Vitest):**
  - with the switch off, `EulogyText` renders what it renders today;
  - cut points: a mention split by a footnote mark and by an erratum, with every piece carrying the mention;
  - the dotted and dashed classes per kind, and the tint on every piece while one piece is hovered;
  - an overlap resolved with a warning;
  - hover opens and leaving closes; click pins; Enter pins; Escape closes and returns focus;
  - the person popup's fallbacks: website language, then English with `lang="en"`, then Latin with `lang="la"`;
  - a person not linked to Wikidata;
  - the place popup imports Leaflet only when it opens;
  - a failed `/api/entities` shows "Details unavailable" and keeps the marks;
  - `/api/entities` returns only what was asked, caps the list, and has its cache header;
  - `useShowIds` still behaves as before.
- **End to end:** a production build against real data, with Chrome installed for Playwright. Check a Latin day and
  an Italian day in a browser: marks, hover, pinning, keyboard, a person popup with a portrait, a place popup with
  its map, and the switch remembered across a reload.

## Success criteria

- In the 2004 Latin edition, at least 98% of place mentions and 95% of person mentions in the text are marked on
  the right words, measured by the extraction report. The rest are in the review change-set.
- Turning the switch off leaves the reader exactly as it is today.
- A person or place popup opens within 100 ms of the hover delay once the day's details are loaded, and the reader
  downloads no snapshot data it doesn't show.
- Every mark and popup works with mouse, touch and keyboard, and is announced sensibly by a screen reader.

## Amendments from planning (2026-10-09)

Settled while writing the four implementation plans (`docs/superpowers/plans/2026-10-09-eulogy-markup-{1..4}-*.md`).
Where these differ from the sections above, these win.

**Data contracts**
- `mentions.json` and `mentions_curated.json` carry `check` (above), never `form`. The API computes `form` from its
  own text when it serves a mention. Review change-sets, which stay private, still carry `form` and `context`.
- `mentions.json` has a top-level `"texts": {"commit": "<sha>" | null}`: the martyrology-texts commit the offsets were
  computed from. The API logs it and warns when its own texts pin differs.
- Footnote *n* counts from 1, in the order the eulogy's footnotes are printed.
- Place QIDs come from crmedr's `gazetteer.json` (`places[<la designation>].wikidata`); `places.json` has none.
- The API always serves `name`, `null` for places. crmedr writes it only on persons.
- `person_details.json`: `born` and `died` are `{"year": int (negative = BCE), "precision": "year" | "decade" |
  "century", "circa": bool}` or `null`, from a new helper (the existing `_date` keeps neither circa nor
  precision). `image` is always present and may be `null`; its `author` and `license_url` may be `null`. The file
  has a `$comment` key.
- The served schema is named `MentionOut`, after the API's convention. The read routes gain documented response
  models, which they lacked.
- A missing `mentions.json` makes the API warn and serve `mentions: []`; a malformed one stops start-up. Reads of a
  curation branch check each mention against the branch's text when serving.

**Change-set operations**
- Every operation carries `kind` and `context_start` (the offset where `context` begins), so a card can place the
  span at `start - context_start`.
- Ids are `<edition>|<eulogy>|<where>|<start>`, with `<where>` = `text` or `footnote:<n>`. An `add_mention` with no
  span (an unmatched person) has `start`, `end` and `form` null, `context` the whole text or footnote with
  `context_start: 0`, and an id ending in the person's name.
- A person inside a place phrase yields two operations, an `add_mention` for the person and a `remove_mention` for
  the place, so the curator chooses.
- `extract_mentions.py` writes the review change-set only to a path given with `--review`, outside the repo, and
  refuses one inside it. In the frontend, `import-changeset --private` writes into `CHANGESETS_DIR` and refuses to
  write any change-set whose operations carry `context` into the public `changesets/`.
- In `/review`, a curator edits a span by clicking its first word, then its last, rather than by selecting text.

**Reader**
- The "Names & places" switch appears only when the day on screen has at least one mention (in either column when
  comparing). Hiding it leaves the stored preference unchanged.
- A click outside a popup returns focus to the mention only when focus was inside the popup.
- `/api/entities` answers more than 200 ids with a 400 problem; the client asks in batches of 200.
- Turning to another day closes an open popup.
- Life dates: "c. 329 – 379"; a decade or a century in each language's own form; BC dates; a date known on one side
  only reads "born c. 329" or "died 258".
