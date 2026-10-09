# Index of places — design

## Purpose

Each edition gets an index of places, like the index at the back of a printed martyrology: an
alphabetical list of the places its eulogies name, each followed by the eulogies that name it and
the day they are printed on, linking to that day in the reader. It is something to browse and to
cite, faithful to the edition.

An index of names was asked for alongside it. It is to list every person a eulogy names, including
companions named only in footnotes (the 2004 footnote to `mr:0206-paulus-miki-et-socii` names 25),
and no such data exists yet: the registry has one subject per eulogy, the first-named, with an
honorific. That data is a separate crmedr project, and the index of names gets its own spec once it
exists. This spec covers the index of places only.

## What the reader sees

### Route and links

- `/<locale>/read/<edition>/places`.
- Linked from the reader bar beside the "Notes & errata" link, wherever that link shows, and from
  the edition's notes page, so an edition's whole-book pages point to one another.

### Header

- The edition's title and year, as on the notes page.
- A coverage note when not every eulogy the edition prints is placed: "1,407 of the 3,223 eulogies
  of this edition are placed so far." Hidden when all are placed.

### The index

- An A–Z bar of the letters that have headings, each an anchor to its section; then a section per
  letter.
- **Headings:** the place's modern name in the interface language, with its country in the
  interface language (`Intl.DisplayNames`): **Rome** (Italy). The label falls back to English, then
  to the Wikidata QID.
- **Lines under a heading,** one per eulogy, in calendar order (`day_printed`, then entry number):
  - the day, linking to the reader at that eulogy: `/read/<edition>/MM/DD#<id>`;
  - the eulogy's subject in the edition's language (la, it or en);
  - the place as the edition prints it, in italics, where we have it (*Romæ*, *A Roma*);
  - the eulogy's typology, with the existing `Map.typology` labels, when it is not `dies_natalis`,
    so a place is not read as the place of death when it is the place of burial or of a
    translation.
- Headings are sorted with `Intl.Collator(locale, { sensitivity: "base" })`; the letter of a heading
  is its first letter with accents folded and in upper case.


### One page per letter (decided 2026-10-09)

The index is shown one letter at a time: `/<locale>/read/<edition>/places` shows the first letter,
`/<locale>/read/<edition>/places/<letter>` any other (the letter in lowercase; `other` for "#"; 404 for
a letter the index does not have). The letter bar links every letter's page and marks the current one
(`aria-current="page"`); "← previous · next →" links close each page; a letter's `<title>` ends in
" — <letter>". The whole list was too heavy for one page (6.0 MB of HTML for the names, 4.1 MB for the
places, most of it the App Router's payload of the rendered list); a letter's page is at most 0.88 MB
(names, I) and 0.46 MB (places). The day links of the index of names are plain links, for the same
reason.

## Data

### Sources

- crmedr `data/places.json`: each current eulogy's stated place, one per eulogy (the place in the
  eulogy's opening phrase), as printed in the 2004 Latin (`la`) and the CEI Italian (`it`).
- crmedr `data/gazetteer.json`: each printed Latin place → Wikidata QID, English label, country.
- crmedr `data/typology.json`: each current eulogy's typology.
- Wikidata: labels in en, it, fr, de, es, pt, and coordinates.
- The API's catalog, `elogia?edition=…&locale=…`: every eulogy with `present`, `day_printed`,
  `entry` and its subject in the requested language.

Only current IDs have places. An older edition's eulogies under deprecated IDs are not placed, so
coverage is about 90% for the 2004 editions and about 40% for 1630, 1749 and 1914 English, which
the coverage note states.

### Snapshot (`scripts/snapshot-registry.mjs` → `data/places-snapshot.json`)

- **Labels:** the script's Wikidata query, which today fetches coordinates, also fetches `rdfs:label`
  in the six interface languages, written as `places[qid].labels: { en, it, fr, de, es, pt }`
  (languages Wikidata lacks are left out). `places[qid].label`, the gazetteer's English label, stays
  as the fallback. Offline, the previous snapshot's labels are reused, as its coordinates are now.
- **Italian printed form:** `eulogies[id].it`, from `places.json`, beside the existing `la`; absent
  where the CEI text has none.
- **Places without coordinates:** kept, with `coords: null` (today 58 eulogies at 16 places are
  dropped). The map skips them.
- The script reports how many places have no label in any language, so they can be fixed in crmedr.

### Server

- `lib/server-editions.ts`, beside `fetchEditions`: `editionInfo(id)`, the edition as the API
  describes it; and `fetchCatalog(edition, lang)`, the API's catalog on the server, from `API_BASE`,
  revalidated hourly. A failed fetch throws.
- `lib/places-index.ts`, pure: `placesIndex(catalog, snapshot, edition, locale)` keeps the eulogies
  the edition prints (`present`) that have a place; groups them by QID; picks the heading label for
  `locale` (`placeLabel`); sorts headings and lines; files headings by letter (`headingLetter`).
  Returns `{ letters: { letter, places: { qid, label, country, lines }[] }[], placed, printed }`.
- **Printed form shown:** `la` for `martyrologium_romanum_2004`, `it` for
  `martyrologium_romanum_2004_it_IT`, none for any other edition: their text may differ from 2004,
  and the 2004 form would mislead there.

### Interface text

New keys in all six `messages/*.json`: the page title, the `<title>` metadata, the coverage note,
the empty note, the error note, the link label and the letter bar's accessible name.

## Errors and edge cases

- **Unknown edition:** 404 (`editionExists`), as the notes page.
- **API unreachable while rendering:** "The index could not be loaded", with a link to reload. Only
  successful fetches are cached, so the next request tries again.
- **An edition that prints no eulogies** (1584, 1914 Latin, 2001 are unavailable): the page says
  "No eulogies of this edition are placed yet".
- **A place with no label in any language:** the QID is its heading.

## Testing

- `placesIndex()` (unit): grouping; eulogies not printed are dropped; collation with accented and
  lowercase first letters; calendar order within a place; the label fallback (locale → English →
  QID); the printed form only for the 2004 Latin and Italian; coverage counts.
- Snapshot script (unit, extending its tests): labels per language, the Italian form, places without
  coordinates kept.
- Map: entries without coordinates are skipped.
- The page (component): letter bar, a heading and its lines, day links ending in `#mr:…`, the
  typology label, the coverage note shown and hidden, the empty and error states.
- The full suite, type check, lint and build; then `/en/read/martyrologium_romanum_2004/places` and
  the 1749 edition's on a local server.

## Out of scope

- The index of names (awaits crmedr data on every person named; its own spec).
- Latin headwords for places.
- Links from the index to the map.
