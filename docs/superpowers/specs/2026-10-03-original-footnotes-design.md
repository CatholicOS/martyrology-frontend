# Original footnotes: the printed editions' own notes — design

**Status:** draft, 2026-10-03. Survey done; open questions resolved 2026-10-03. Ready for review, then planning.
**Repos:** `martyrology-api` (data shape, loader, responses; the public 1914 data and its digitizer),
`martyrology-texts` (the private 2004 data and its extraction), `martyrology-frontend` (display).
**Related:** the curators' notes (frontend PR #55), which are *our* notes, shown only with the IDs
switch and marked `†`, `††`, … in red. This design covers the notes the **printed books** carry, which are
part of the text and are always shown.

## Goal

Capture the footnotes each printed edition sets under its eulogies, keep them with the marks the print
gives them (its numbers, or its asterisks), and show them in the reader wherever the eulogy is shown,
whether the IDs switch is on or off. They are part of the edition's text, so the same access rules apply.

## Decisions taken

| Question | Decision |
|---|---|
| Source | **The PDFs** in `C:\Users\johnr\Documents\LitCal\Roman Martyrology`. The digitization workbooks are outdated and carry no footnotes, so they are not used. |
| Visibility | **Always shown**, not behind the IDs switch. |
| Numbering | **As printed.** The reader shows the print's own mark, never a renumbering. |
| Curators' notes vs printed notes | The curators' notes are marked with **daggers** (†, ††, …) in **every** edition (frontend PR #55), so asterisks and numbers always belong to the print. |
| A footnote whose anchor phrase can't be found | Its mark goes at the **end of the eulogy**; the note still appears at the foot of the page, and the extraction check reports it. |
| The parallel view | Each sheet shows **its own** footnotes only. Nothing is said on the facing sheet when the other edition has no footnote there. |
| Order of the work | **2004 Latin** first (the largest set, and the editio typica), then **Italian** (it can borrow names from the Latin), then **2004 English** and **1914**. |

## What the books carry (survey, 2026-10-03)

| Edition (CLBDR id) | PDF | Footnotes in the calendar | Marks | Text layer |
|---|---|---|---|---|
| `martyrologium_romanum_2004` (Latin) | `Martyrologium Romanum (2004).pdf`, 850 pp., calendar ≈ pp. 79–697 | **66** found by layout; 61 begin *Quorum/Quarum nomina:* (the names behind "N. and companions"), 2 *Inter quos:* | Superscript digits after a word ("sociorum,¹"), **numbered from 1 each month** | Scan with an OCR layer: usable for layout, with OCR errors to proofread ("n6mina" for *nómina*, "beatre" for *beatae*) |
| `martyrologium_romanum_2004_it_IT` (CEI) | `Martirologio-Romano.pdf`, 1144 pp., calendar ≈ pp. 104 to the end | **≈ 64** *I loro nomi sono: …* (the same notes as the Latin), plus layout noise to filter | Superscript digits; numbering seems to follow the Latin | Born digital, but the font loses some letters (Korean, Vietnamese diacritics: "Py ng-ju"), to restore from the Latin |
| `martyrologium_romanum_2004_en_unofficial` | `roman-martyrology-2004-in-english-entire-all-months.pdf`, 811 pp. | **≥ 6** found (July, *Whose names are: …*); the survey's layout test may miss others | Superscript digits | Born digital |
| `martyrologium_romanum_1914_en_unofficial` | `The Roman Martyrology (1914).pdf`, 488 pp. | Some (e.g. p. 22: "the birthday*" → *In the language of the Church, birthday refers to…*); count to come from extraction | **Asterisks** (and probably `**` or `†` for a second note on a page) | Scan whose text layer has its spaces stripped; the digitizer re-OCRs it and **drops footnote lines on purpose** today (`digitize_1914_en.py`, `clean_lines`) |
| `martyrologium_romanum_1749` | `martyrologium_romanum 1749.pdf` (2013 retyping) | **None.** Apart from the title pages, the only small text is page numbers. | — | Born digital |

The front matter (the Praenotanda) has its own footnotes (Latin pp. 13–16: *Cf. Concilium Oecumenicum
Vaticanum II…*). They are **out of scope**: the API serves no front matter.

## Data shape

Footnotes go in a file beside each edition's monthly files, `footnotes.json`, rather than inline in
the eulogy text, so that every consumer of `text` (search, alignment, the misprint matcher, exports)
keeps working unchanged:

```json
{
  "mr:0115-ioannes-baptista-triquerie-et-socii": [
    { "mark": "1", "after": "sociorum,", "text": "Quorum nomina: beati Ioannes Baptista Triquerie, …" }
  ]
}
```

- `mark` is the printed mark as a string ("1", "12", "*", "†"), never a number we computed.
- `after` is the word or phrase the mark follows, which must occur **exactly once** in that eulogy's
  text as whole words. It's the rule the misprint notes already use (`lib/misprints.ts`), and it keeps
  the anchor valid when the text is proofread elsewhere. A footnote whose anchor stops matching stays
  in the data, its mark is set at the end of the eulogy, and a check reports it.
- Keyed by canonical id, in printed order, like the monthly files of aligned editions. A footnote on a
  day's titulus or conclusio, if any turns up, gets the keys `"titulus:MM-DD"` and `"conclusio:MM-DD"`.
- 2004 editions: `martyrology-texts/data/editions/{edition}/footnotes.json`. 1914:
  `martyrology-api/data/editions/martyrologium_romanum_1914_en_unofficial/footnotes.json`.

## API

- The loader reads `footnotes.json` when present (as it reads `source.json` today, `store.py`).
- `ElogiumOut` (day and month responses) and `EditionPlacementOut` (`/elogium/{id}`) gain
  `footnotes: list[FootnoteOut]` (`mark`, `after`, `text`), empty when the edition has none.
- **Redaction:** footnotes are text. Where `text` is redacted (`restricted-texts`), `footnotes` is
  emptied too.
- Curator drafts (the writer's draft months) are out of scope at first: footnotes change by pull
  request to the data repos until the curation UI needs them.

## Frontend

- `EulogyText` places each footnote's printed mark, as a superscript link, after its `after` phrase
  (the same split as the misprint notes, so both can apply to one eulogy), or at the end of the
  eulogy when the phrase can't be found. The mark is set in the **text colour, as in the print**,
  unlike the curators' red daggers.
- At the foot of the page (or of each sheet in the spread), the printed footnotes come first, under the
  short rule, each starting with its printed mark and linking back. The curators' notes, when shown,
  follow in their own block, with red daggers, so the two are never confused.
- The parallel view lays each sheet's footnotes in the closing row, as the curators' notes are today.
  A sheet shows only its own edition's footnotes.

## Extraction

One script per source, each writing `footnotes.json` and a report of what it couldn't place:

1. **2004 Latin:** find footnote lines by layout (calendar pages; lines in the lower part of the page
   set smaller than the body; a leading number), join continuation lines, find the superscript mark in
   the body by span size and position, and take the word before it as `after`. Assign each eulogy by
   the day heading and the printed entry number, then map to the canonical id through the registry.
   Then proofread: names in the OCR layer need checking against the scan.
2. **2004 Italian:** the same layout rules. Restore the lost letters from the Latin note with the same
   mark (both list the same names).
3. **2004 English:** the same layout rules, after a full survey; the six found so far may not be all.
4. **1914:** change `digitize_1914_en.py` to keep footnote lines and their asterisk marks instead of
   dropping them, then attach each to the eulogy whose text carries the mark on that page. The OCR
   may lose the in-text asterisk, so the report lists notes it couldn't anchor, for a manual pass.

Each script is rerunnable and leaves manual corrections in a separate overrides file it applies last,
so a rerun doesn't undo proofreading.

## Testing

- Extraction: fixtures of a few real pages per PDF (text-layer dumps, not the copyrighted PDF itself
  for 2004), with the expected footnotes.
- API: loader and response tests for `footnotes`, including redaction.
- Frontend: placement after the anchor phrase, coexistence with a misprint note in one eulogy, the
  unmatched-anchor fallback, numbering as printed, and both note blocks on one page.

## Out of scope

- Front-matter footnotes (the Praenotanda).
- Baronius's editio princeps (`Martyrologium Romanum Editio Princeps - Baronius.pdf`): the API serves
  no 1584 texts, and its *Notationes* are a commentary, not footnotes.
- Editing footnotes through the curation API.

## Resolved questions

All four were settled on 2026-10-03 and are recorded under **Decisions taken**:

1. **The 1914 asterisk clash:** the curators' notes moved to daggers in every edition, so no edition's
   asterisks are ever ours.
2. **A footnote we can't anchor:** mark at the end of the eulogy.
3. **The parallel view:** each sheet shows its own footnotes only.
4. **Order of the work:** 2004 Latin, then Italian, then 2004 English and 1914.
