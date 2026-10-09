# Index of names — design

Date: 2026-10-09. Round 2 of the persons work. Builds on crmedr's
`docs/superpowers/specs/2026-10-08-persons-design.md` (the data, CatholicOS/crmedr#79) and on this
repository's `docs/superpowers/specs/2026-10-08-places-index-design.md` (the index of places, whose
page this mirrors).

## Purpose

Each edition gets an index of names, like the *Index nominum* of a printed Latin martyrology: the
saints and blessed its eulogies commemorate, A–Z, each with the eulogies that name them. A name
printed in a eulogy's text links to the eulogy; a name printed in a footnote links to that footnote.

Today crmedr has the persons of the 2004 Latin edition only; other editions show that their index
is not ready.

## What the reader sees

### Route and links

- `/<locale>/read/<edition>/names`.
- Linked from the reader bar and from the notes page, beside the index of places, for an edition
  with persons data only.

### Header

- The edition's title and year; links to the edition, its notes and its index of places.
- A coverage note: "4,578 of the 4,636 eulogies of this edition name someone." (feasts of the Lord
  and anonymous groups name no one), from the catalog's printed eulogies.
- For an edition without persons data: "The persons of this edition are not indexed yet."

### Headings

- The **Latin name** as the edition uses it: **Basilius**, **Paulus Miki**.
- Sorted with `Intl.Collator("la", { sensitivity: "base" })` (the runtime falls back to the root
  order when it has no Latin data), by the whole name, so by its first word: *Paulus Miki* under P,
  as Latin indexes of saints do. Filed by the folded first letter, by the same rule as the index of
  places (a letter the fold leaves whole, Đ, Ł, Æ, under the A–Z letter it sorts with).
- Where the person is identified: their name in the interface language follows in grey, linked to
  Wikidata (*Basil the Great ↗*), from the Wikidata label in the interface language, else English;
  no label, no grey name (the Wikidata link alone).
- **One heading per person:** keyed by Wikidata QID when identified, else by the Latin name. An
  identified person named in several Latin forms (*Augustinus*, *Aurelius Augustinus*) is headed by
  the most frequent form (ties: the shorter, then the first in calendar order).

### Lines

One per mention, in calendar order (`day_printed`, the unnumbered first on their day, then entry
number):
- the day, linking to the eulogy (`/read/<edition>/MM/DD#<id>`) when the name is in the text, or to
  the footnote (`/read/<edition>/MM/DD#fn-<edition>-<id>-<n>`) when it is in the nth footnote;
- the eulogy's subject in the edition's language (so a companion's line reads "2 June · Sancti
  Pothinus et socii");
- "in footnote n" for a footnote mention.

Each day link's accessible name includes the subject, as in the index of places.


### One page per letter (decided 2026-10-09)

The index is shown one letter at a time: `/<locale>/read/<edition>/names` shows the first letter,
`/<locale>/read/<edition>/names/<letter>` any other (the letter in lowercase; `other` for "#"; 404 for
a letter the index does not have). The letter bar links every letter's page and marks the current one
(`aria-current="page"`); "← previous · next →" links close each page; a letter's `<title>` ends in
" — <letter>". The whole list was too heavy for one page (6.0 MB of HTML for the names, 4.1 MB for the
places, most of it the App Router's payload of the rendered list); a letter's page is at most 0.88 MB
(names, I) and 0.46 MB (places). The day links of the index of names are plain links, for the same
reason.

## Data

### Snapshot: `data/persons-snapshot.json`

`scripts/snapshot-registry.mjs` writes it from crmedr's `data/persons.json` and
`data/person_items.json`:

```json
{
  "editions": {
    "martyrologium_romanum_2004": {
      "mr:0206-paulus-miki-et-socii": [
        { "name": "Paulus Miki", "where": "text", "wikidata": "Q380649" },
        { "name": "Ioannes de Goto Soan", "where": { "footnote": 1 } }
      ]
    }
  },
  "labels": { "Q380649": { "en": "Paul Miki", "it": "Paolo Miki" } }
}
```

- `wikidata` only for `auto` and `reviewed` decisions; `unresolved` and undecided persons have none.
- `labels`: each QID's Wikidata label in the six interface languages, in their fixed order, by the
  script's `fetchLabels`; offline, the previous snapshot's labels are reused (as for places).
- A rerun of the snapshot after curators' decisions are applied in crmedr brings them in.

### `lib/names-index.ts` (pure)

`namesIndex(catalog, snapshot, edition, locale)`:
- the edition's printed eulogies (`present`, a printed day), as in `placesIndex`;
- the persons of those eulogies, grouped by key (QID, else the Latin name), the heading form
  chosen as above, the interface label attached;
- headings sorted and filed by letter; lines in calendar order;
- `printed` and `naming` counts for the coverage note; `null` when the snapshot has no persons for
  the edition.

The catalog comes from `fetchCatalog` (`lib/server-editions.ts`, cached hourly), as for places.

### The page

`app/[locale]/read/[edition]/names/page.tsx` and `components/NamesIndex.tsx`, mirroring the places
route and component: 404 for an unknown edition; the error note with a retry link (and the cause
logged on the server) when the catalog cannot be loaded; the "not indexed yet" note.

### The reader

`components/Reader.tsx` finds a `#fn-…` address as it finds `#note-…`: once the day is drawn, it
scrolls to the footnote and marks it briefly. Footnotes are always drawn, so the IDs switch is not
touched. `components/page.module.css` gives a found footnote the same wash as a found eulogy, and a
ring under reduced motion.

### Interface text

New keys in all six `messages/*.json`: the page title, the `<title>` metadata, the coverage note,
the "not indexed yet" note, the error note, "in footnote {n}", the link label, the letter bar's
accessible name.

## Errors and edge cases

- Unknown edition: 404.
- API unreachable: the error note, the cause logged.
- An edition without persons data: the "not indexed yet" note; no link from the reader bar or the
  notes page.
- A QID with no label in any language: the Latin heading and the Wikidata link only.
- A snapshot person whose eulogy the edition's catalog does not print: not listed, not counted.

## Testing

- `namesIndex()`: grouping by QID and by Latin name; the most frequent form (and its ties); Latin
  collation and filing by letter; calendar order with the unnumbered first; text mentions link to the
  eulogy and footnote mentions to `#fn-<edition>-<id>-<n>`; the label in the interface language with
  the English fallback; the counts; eulogies not printed dropped; `null` without persons data.
- The snapshot script: the persons snapshot (QIDs only for `auto` and `reviewed`; labels in order)
  and its offline fallback.
- `NamesIndex` and the route, as for places, including the "not indexed yet" and error states.
- The reader: a `#fn-…` address finds and marks the footnote on opening and on a hash change, and
  leaves the IDs switch as it was.
- The links: shown for an edition with persons data only.
- The full suite, type check, lint and build; then, on a local server against the live API, the
  2004 Latin and the 1749 pages, and a footnote link landing on its footnote.

## Out of scope

- Persons of the other editions (crmedr rounds 3 and 4).
- Links from the index of names to the index of places or the map.
- The curators' review of the queue.
