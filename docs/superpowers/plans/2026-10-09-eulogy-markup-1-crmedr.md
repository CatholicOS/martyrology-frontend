# Eulogy markup, plan 1 of 4: the mentions and person details in crmedr — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** crmedr records where each person and place is named in the 2004 Latin and Italian texts (`data/mentions.json`), lets curators correct that (`data/mentions_curated.json`, three change-set operations, `apply`), and gathers what the reader's person popups show (`data/person_details.json`).

**Architecture:**
- `scripts/mentions_text.py` holds pure matching functions. They work on a folded copy of a text whose every character maps back to the printed character it comes from, so a span found in the copy is a span in the print.
- `scripts/extract_mentions.py` reads the private `martyrology-texts` checkout and crmedr's persons, places, gazetteer and person items. It writes the mentions, a report, and a review change-set that goes outside the repository.
- `scripts/person_details.py` uses the existing cached Wikidata client, extended for descriptions, sitelinks, life dates and Commons credits.

**Tech Stack:** Python 3 (3.12 locally; 3.9+ needed for `str.removeprefix`, `Path.is_relative_to`), standard library only, `unittest`. Wikidata and Commons APIs, with responses cached under `.cache/wikidata/`.

**Spec:** `martyrology-frontend/docs/superpowers/specs/2026-10-09-eulogy-markup-design.md` (sections "crmedr", "Change-set operations", "Testing").

**Repository:** `/home/johnrdorazio/development/CatholicOS_org/crmedr`. The private texts are at `../martyrology-texts`. Every path below is relative to the crmedr root unless it says otherwise.

## Global Constraints

- **Standard library only.** No new dependency, no `requirements` file. This follows crmedr's AGENTS.md.
- **No eulogy text in the repository**, beyond the place designations already in `data/places.json`. crmedr's policy is unchanged: no printed person form is stored.
  - Mentions record where words are printed, as offsets plus a `check`, never the words themselves.
  - The words exist only in memory (`form` on the internal mentions) and in the private review change-set.
  - The review change-set quotes context, so it is **never** written inside the repository: `extract_mentions.py` refuses a path inside it.
  - A span may still cover at most 20 words (`MAX_FORM_WORDS`), as a guard against runaway matches.
- **Editions:**
  - `martyrologium_romanum_2004` (lang `la`) gets places and persons.
  - `martyrologium_romanum_2004_it_IT` (lang `it`) gets places only.
- **Offsets** in `data/mentions.json`, `data/mentions_curated.json` and the change-set are **UTF-16 code units**. Python works in code points internally and converts at output with `utf16()` / `from_utf16()`.
- **`data/mentions.json` shape** (spec, binding):
  - `{"$comment", "texts": {"commit"}, "editions": {edition: {eulogy: [mention]}}}`.
  - Each mention's keys come in this order: `kind`, `where`, `start`, `end`, `check`, `name` (persons only), `qid`. There is no `form` key, in `mentions.json` or in `mentions_curated.json`.
  - `check` is the first 8 lowercase hex digits of SHA-256 over the UTF-8 bytes of exactly the printed span: `hashlib.sha256(text[start:end].encode("utf-8")).hexdigest()[:8]`, where `text[start:end]` is the original, unfolded characters the UTF-16 span covers.
  - `where` is `"text"` or `{"footnote": n}`. Footnote offsets count from that footnote's `text`.
- **QIDs are copied, never decided here:**
  - a person's from `data/person_items.json` → `persons[eulogy][name].wikidata`;
  - a place's from `data/gazetteer.json` → `places[<la designation>].wikidata`.

  Either is `null` while undecided.
- **Tests:** `python3 -m unittest discover -s tests`, run from the crmedr root. Fixtures are short invented Latin and Italian strings, never real 2004 text at length.
- **Commits:** end every commit message with the session's attribution lines.
- **Spec amendments agreed with plans 2 and 4.** They are binding, and they win over the spec's examples:
  1. Every change-set op (`add_mention`, `set_span`, `remove_mention`) carries `context_start`: the UTF-16 offset in the eulogy text (or footnote text) at which `context` begins. A card places a span at `start - context_start`.
  2. `kind` (`"person"` or `"place"`) is required on all three ops.
  3. An `add_mention` for an unmatched person with no span:
     - `start`, `end` and `form` are `null`;
     - `context` is the whole text (or the whole footnote), with `context_start: 0`;
     - the id ends with the person's name: `<edition>|<eulogy>|<where>|<name>`.
  4. The `<where>` part of every op id is `text` or `footnote:<n>`. Other ids are `<edition>|<eulogy>|<where>|<start>`, with `start` in UTF-16.
  5. The review change-set is written only to a path given with the **required** `--review PATH` option, and `.gitignore` excludes `mentions-review.json`.
  6. `data/mentions.json` records the `martyrology-texts` commit its offsets were computed from, as the top-level `"texts": {"commit": "<sha>"}` (from `git -C <texts> rev-parse HEAD`; `null` when the texts path is not a git checkout).
  7. `name` is emitted only for persons. The API fills `null` for places.
  8. `born` and `died` in `data/person_details.json` are objects, `{"year": <int, negative for BCE>, "precision": "year" | "decade" | "century", "circa": <bool>}`, or `null` when unknown.
     - The precision comes from Wikidata's time precision: 9 or finer gives `"year"`, 8 `"decade"`, 7 `"century"`. A coarser claim is skipped, and the date is `null` when no usable claim is left.
     - `circa` comes from the P1480 (sourcing circumstances) qualifier being Q5727902 on the claim.
     - A new helper, `life_date`, does this. The existing `_date` keeps its behaviour for its callers.
  9. `image` is `null` (key present) when there is no portrait or Commons gives no license.
  10. `data/person_details.json` starts with a `"$comment"` key, as every crmedr data file does; consumers skip keys starting with `$`.
  11. **Footnote numbering:** in `where: {"footnote": n}`, `n` counts from 1, in the order the eulogy's footnotes are printed. That is the order of the edition's `footnotes.json` list for that eulogy, the same `n` as `persons.json`. Offsets count from the start of that footnote's `text`.
  12. **`check` replaces `form`** in `data/mentions.json` and `data/mentions_curated.json`, by the repository owner's decision. It is defined above.
      - The review change-set ops keep `form` and `context`, since they never enter the repository.
      - `apply` computes `check` from the texts for each accepted op's span.

## Review Focus

These are inputs that no spec test pins, but that will meet the code on real data. Each has its test in the task named.

- **A text corrected after a curator's fix.** A curated span's words then no longer pass its `check`. The extraction must stop and name the eulogy, never write a shifted span. (Task 5, `test_a_curated_span_whose_check_fails_is_an_error`.)
- **A name with an apostrophe or hyphen** ("Maria Margarita d'Youville", printed with `’`). It must be found, not crash the regex. (Task 3, `test_apostrophe_typographic_in_print`.)
- **A common lowercase word sharing a name's stem or spelling** ("pius sacerdos" before "Pius papa"). It must never be marked. (Task 3, `test_a_capital_letter_is_required`.)
- **A eulogy with persons or places but no text filed under its own ID in an edition.** It is skipped and listed in the report, not a crash or a `KeyError`. (Task 5, `test_marks_counts_and_skips_eulogies_without_a_text`.)
- **A Wikidata item that is deleted (`missing`), bare (no descriptions, dates, image or sitelinks), or whose portrait has no license.** Its details are left out or emptied gracefully. (Task 8, `test_entities_and_commons`; Task 9, `test_a_bare_item` and `test_no_license_no_image`.)

## File Structure

| Path | Change | Responsibility |
|---|---|---|
| `scripts/mentions_text.py` | create | Pure matching: `fold_map`, `to_print`, `free`, `utf16`, `from_utf16`, `find_place`, `back_ref_span`, `name_patterns`, `find_person`, `partial_span` |
| `scripts/extract_mentions.py` | create | `eulogy_mentions`, `build_edition`, `validate`, `render_json`, `render_report`, `review_ops`, `apply_decisions`, `apply`, `extract`, `main` |
| `scripts/wikidata.py` | modify | `DETAIL_LANGS`, `COMMONS_API`, `life_date`, `Wikidata.details_entities`, `Wikidata.commons_files` |
| `scripts/person_details.py` | create | `summarize_details`, `image_credit`, `person_qids`, `build`, `render_json`, `main` |
| `data/mentions.json` | generated | The mentions |
| `data/mentions_curated.json` | create | Curators' replacements by eulogy (initially empty) |
| `data/person_details.json` | generated | Person popup details by QID |
| `docs/mentions-report.md` | generated | Counts, shares, review totals; IDs only |
| `docs/mentions-changeset.md` | create | The three change-set operations |
| `tests/test_mentions_text.py` | create | Tests for `mentions_text.py` |
| `tests/test_extract_mentions.py` | create | Tests for `extract_mentions.py` |
| `tests/test_person_details.py` | create | Tests for the `wikidata.py` additions and `person_details.py` |
| `.gitignore` | modify | `mentions-review.json` |
| `AGENTS.md`, `README.md` | modify | One sentence on offsets plus a hash (no exception), the two new pipeline steps, the README entries |

---

### Task 1: Folding with a map back to the print, and UTF-16 offsets

**Files:**
- Create: `scripts/mentions_text.py`
- Test: `tests/test_mentions_text.py`

**Interfaces:**
- Consumes: `extract_places.base_copy`, `persons_text.PARTICLES` (imported now, used in Tasks 2–3).
- Produces:
  - `fold_map(text: str) -> tuple[str, list[int]]`
  - `to_print(index: list[int], start: int, end: int) -> tuple[int, int]`
  - `free(span: tuple[int, int], taken: Iterable[tuple[int, int]]) -> bool`
  - `utf16(text: str, i: int) -> int`
  - `from_utf16(text: str, u: int) -> int`

- [ ] **Step 1: Create the branch**

```bash
cd /home/johnrdorazio/development/CatholicOS_org/crmedr
git checkout main && git pull && git checkout -b feat/mentions
```

- [ ] **Step 2: Write the failing tests**

`tests/test_mentions_text.py`:

```python
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import mentions_text as mt  # noqa: E402


class FoldMapTest(unittest.TestCase):
    def test_folds_and_maps_back_to_the_print(self):
        folded, index = mt.fold_map("Cæsaréæ Iulii")
        self.assertEqual(folded, "caesareae iulii")
        start = folded.index("sareae")
        # "æ" folds to two letters; both map back to the one printed character.
        self.assertEqual(mt.to_print(index, start, start + len("sareae")), (2, 7))

    def test_reads_j_and_v_as_i_and_u_and_the_typographic_apostrophe_as_plain(self):
        self.assertEqual(mt.fold_map("Iosephus Vincentius")[0], mt.fold_map("Josephus Uincentius")[0])
        self.assertEqual(mt.fold_map("d’Youville")[0], "d'youuille")


class FreeTest(unittest.TestCase):
    def test_touching_is_free_overlapping_is_not(self):
        self.assertTrue(mt.free((5, 9), [(0, 5), (9, 12)]))
        self.assertFalse(mt.free((4, 9), [(0, 5)]))


class Utf16Test(unittest.TestCase):
    def test_counts_characters_outside_the_bmp_twice(self):
        text = "\U0001D510ab"
        self.assertEqual(mt.utf16(text, 2), 3)
        self.assertEqual(mt.from_utf16(text, 3), 2)

    def test_the_bmp_is_one_to_one(self):
        self.assertEqual(mt.utf16("Romæ", 4), 4)
        self.assertEqual(mt.from_utf16("Romæ", 4), 4)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_mentions_text -v`
Expected: ERROR, `ModuleNotFoundError: No module named 'mentions_text'`.

- [ ] **Step 4: Write the implementation**

`scripts/mentions_text.py`:

```python
"""Locate the persons and places a eulogy names (standard library only).

Pure functions over a printed text and the names and place designations crmedr
already holds. They return spans, (start, end) offsets in the printed text, and
never text. Matching runs on a folded copy whose every character maps back to
the printed character it comes from, so a span found in the copy is a span in
the print. See martyrology-frontend's
docs/superpowers/specs/2026-10-09-eulogy-markup-design.md.
"""

import re
import unicodedata

from extract_places import base_copy
from persons_text import PARTICLES

# Folded as name_key folds names: æ/œ spelled out, j/v read as i/u, ’ as '.
LIGATURES = {"æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe"}
LETTERS = {"j": "i", "v": "u", "’": "'"}


def fold_map(text):
    """`text` folded for matching (accents stripped, lowercase, æ/œ spelled out,
    j/v read as i/u), and for each folded character the index of the printed
    character it comes from."""
    out, index = [], []
    for i, c in enumerate(text):
        if c in LIGATURES:
            f = LIGATURES[c]
        else:
            base = "".join(x for x in unicodedata.normalize("NFD", c) if not unicodedata.combining(x))
            f = "".join(LETTERS.get(x, x) for x in (base if len(base) == 1 else c).lower())
        out.append(f)
        index += [i] * len(f)
    return "".join(out), index


def to_print(index, start, end):
    """The printed span of the folded span [start, end)."""
    return index[start], index[end - 1] + 1


def free(span, taken):
    """Whether `span` overlaps none of the spans in `taken` (touching is not overlapping)."""
    return all(span[1] <= s or span[0] >= e for s, e in taken)


def utf16(text, i):
    """Code-point offset `i` in `text` as a UTF-16 offset, the unit JavaScript strings count in."""
    return i + sum(1 for c in text[:i] if ord(c) > 0xFFFF)


def from_utf16(text, u):
    """UTF-16 offset `u` in `text` as a code-point offset."""
    i = n = 0
    while n < u and i < len(text):
        n += 2 if ord(text[i]) > 0xFFFF else 1
        i += 1
    return i
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_mentions_text -v`
Expected: 5 tests, OK.

- [ ] **Step 6: Commit**

```bash
git add scripts/mentions_text.py tests/test_mentions_text.py
git commit -m "mentions: fold a text with a map back to the print, and UTF-16 offsets"
```

---

### Task 2: Places, as printed and as back-references

**Files:**
- Modify: `scripts/mentions_text.py` (append)
- Test: `tests/test_mentions_text.py` (append the classes before `if __name__`)

**Interfaces:**
- Consumes: `fold_map`, `to_print`, `free` (Task 1), `extract_places.base_copy`.
- Produces:
  - `find_place(text: str, form: str, taken=()) -> tuple[int, int] | None`
  - `back_ref_span(text: str, lang: "la" | "it") -> tuple[int, int] | None`

- [ ] **Step 1: Write the failing tests**

```python
class FindPlaceTest(unittest.TestCase):
    def test_as_printed(self):
        text = "Cæsaréæ in Cappadócia, commemorátio sancti Basilíi, magístri."
        form = "Cæsaréæ in Cappadócia"
        self.assertEqual(mt.find_place(text, form), (0, len(form)))

    def test_after_folding_case_and_accents(self):
        text = "Sempre a Roma, presso la via Appia, beato Nemo."
        start, end = mt.find_place(text, "A Roma")
        self.assertEqual(text[start:end], "a Roma")

    def test_skips_a_taken_span(self):
        self.assertEqual(mt.find_place("Romæ et Romæ", "Romæ", [(0, 4)]), (8, 12))

    def test_not_found(self):
        self.assertIsNone(mt.find_place("Ibídem, beáti Nemo.", "Londínii in Anglia"))


class BackRefTest(unittest.TestCase):
    def test_latin_ibidem(self):
        self.assertEqual(mt.back_ref_span("Ibídem, beáti Thomæ, presbýteri.", "la"), (0, 6))

    def test_italian_covers_the_place_name(self):
        text = "Sempre a Londra, beato Tommaso, sacerdote."
        start, end = mt.back_ref_span(text, "it")
        self.assertEqual(text[start:end], "Sempre a Londra")
        text = "Ivi, santa Nemo, vergine."
        start, end = mt.back_ref_span(text, "it")
        self.assertEqual(text[start:end], "Ivi")

    def test_none_without_a_back_reference(self):
        self.assertIsNone(mt.back_ref_span("Romæ, sancti Nemo.", "la"))
        self.assertIsNone(mt.back_ref_span("A Roma, san Nemo.", "it"))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_mentions_text -v`
Expected: the 7 new tests ERROR with `AttributeError: module 'mentions_text' has no attribute 'find_place'` (or `'back_ref_span'`).

- [ ] **Step 3: Write the implementation (append to `scripts/mentions_text.py`)**

```python
# The opening words that set a eulogy at the place of the one before it
# (data/places.json gives such a eulogy `via` and its root's designation).
BACK_REF_LA = re.compile(r"(?:Ibidem|Item)\b")
BACK_REF_IT = re.compile(r"(?:(?:Sempre|Ancora)\s|Ivi\b|Nello stesso luogo\b|Nella stessa citta\b)[^,;:]*")


def find_place(text, form, taken=()):
    """The first free span of a place designation in `text`: as printed, else
    after folding (the Italian "A Roma" is printed "a Roma" after "Sempre")."""
    start = text.find(form)
    while start >= 0:
        if free((start, start + len(form)), taken):
            return start, start + len(form)
        start = text.find(form, start + 1)
    folded, index = fold_map(text)
    target = fold_map(form)[0]
    start = folded.find(target) if target else -1
    while start >= 0:
        span = to_print(index, start, start + len(target))
        if free(span, taken):
            return span
        start = folded.find(target, start + 1)
    return None


def back_ref_span(text, lang):
    """The opening words that set a eulogy at the place of the one before:
    "Ibídem" or "Item" (Latin); "Sempre a Londra", "Ivi" (Italian, the place's
    name included). None when the text does not open with them."""
    copy = base_copy(text)  # one character to one: offsets in the copy are printed offsets
    m = (BACK_REF_LA if lang == "la" else BACK_REF_IT).match(copy)
    if not m:
        return None
    return 0, len(copy[:m.end()].rstrip())
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_mentions_text -v`
Expected: 12 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/mentions_text.py tests/test_mentions_text.py
git commit -m "mentions: find a place as printed, after folding, or as a back-reference"
```

---

### Task 3: Persons, verbatim, by stem, and across one parenthesis or cognomento

**Files:**
- Modify: `scripts/mentions_text.py` (append)
- Test: `tests/test_mentions_text.py` (append)

**Interfaces:**
- Consumes: `fold_map`, `to_print`, `free` (Task 1), `persons_text.PARTICLES`.
- Produces:
  - `name_patterns(name: str) -> list[tuple[str, str]]`, giving the steps `"verbatim"`, `"stem"`, `"gap"`
  - `find_person(text: str, name: str, taken=()) -> tuple[tuple[int, int], str, bool] | None`, returning (span, how, ambiguous)
  - `partial_span(text: str, name: str, taken=()) -> tuple[int, int] | None`

- [ ] **Step 1: Write the failing tests**

```python
def span_text(text, found):
    return text[found[0][0]:found[0][1]]


class FindPersonTest(unittest.TestCase):
    def test_verbatim_first(self):
        found = mt.find_person("Romæ, sancta Agnes, virgo.", "Agnes")
        self.assertEqual((span_text("Romæ, sancta Agnes, virgo.", found), found[1]), ("Agnes", "verbatim"))

    def test_a_genitive_by_stem(self):
        text = "Cæsaréæ in Cappadócia, commemorátio sancti Basilíi, magístri."
        found = mt.find_person(text, "Basilius")
        self.assertEqual((span_text(text, found), found[1], found[2]), ("Basilíi", "stem", False))

    def test_across_a_parenthesis(self):
        text = "In Nemópoli, beátæ Nemæ Fictínæ (Nemæ Stellæ) Nemau, vírginis."
        found = mt.find_person(text, "Nema Fictina Nemau")
        self.assertEqual((span_text(text, found), found[1]), ("Nemæ Fictínæ (Nemæ Stellæ) Nemau", "gap"))

    def test_across_cognomento(self):
        text = "Nemónii, sancti Nemárdi, cognoménto Fictóris, regis."
        found = mt.find_person(text, "Nemardus Fictor")
        self.assertEqual(span_text(text, found), "Nemárdi, cognoménto Fictóris")

    def test_only_one_gap(self):
        self.assertIsNone(mt.find_person("Romæ, beáti Petri (Ioánnis) Magni (Pauli) Nemínis.", "Petrus Magnus Nemo"))

    def test_a_capital_letter_is_required(self):
        text = "Romæ, pius sacérdos et sanctus Pius papa."
        start = text.index("Pius")
        self.assertEqual(mt.find_person(text, "Pius")[0], (start, start + 4))

    def test_a_name_inside_a_taken_span_is_skipped(self):
        text = "Romæ, beatórum Petri a Iesu María, presbýteri, et Maríæ, vírginis."
        first = mt.find_person(text, "Petrus a Iesu Maria")
        self.assertEqual(span_text(text, first), "Petri a Iesu María")
        second = mt.find_person(text, "Maria", [first[0]])
        self.assertEqual((span_text(text, second), second[2]), ("Maríæ", False))

    def test_ambiguous(self):
        text = "Romæ, sanctórum Felícis presbýteri et Felícis diáconi."
        found = mt.find_person(text, "Felix")
        self.assertEqual((found[0], found[2]), ((text.index("Felícis"), text.index("Felícis") + 7), True))

    def test_apostrophe_typographic_in_print(self):
        text = "Marianópoli, beátæ Maríæ Margarítæ d’Youville, víduæ."
        found = mt.find_person(text, "Maria Margarita d'Youville")
        self.assertEqual(span_text(text, found), "Maríæ Margarítæ d’Youville")

    def test_not_found(self):
        self.assertIsNone(mt.find_person("Romæ, sancti Nemo.", "Felix"))


class PartialSpanTest(unittest.TestCase):
    def test_the_first_word_by_stem(self):
        text = "Romæ, beáti Ioánnis a Cruce, presbýteri."
        start, end = mt.partial_span(text, "Ioannes Baptista")
        self.assertEqual(text[start:end], "Ioánnis")

    def test_none(self):
        self.assertIsNone(mt.partial_span("Romæ, sancti Nemo.", "Felix"))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_mentions_text -v`
Expected: the 12 new tests ERROR with `AttributeError: module 'mentions_text' has no attribute 'find_person'` (or `'partial_span'`).

- [ ] **Step 3: Write the implementation (append to `scripts/mentions_text.py`)**

```python
# Between two words of a name: a space, or (in the third step only) one
# parenthesis ("Nemæ Fictínæ (Nemæ Stellæ) Nemau") or cognomento phrase
# ("Nemárdi, cognoménto Fictóris").
WIDE_GAP = r"(?:\s+|\s*\([^)]*\)\s*|\s*,\s*cognomento\s+)"


def _word_pattern(word):
    """A folded name word: a particle whole, any other word by its stem (the word
    less its last two letters, at least three letters long) and any ending."""
    if word in PARTICLES:
        return re.escape(word) + r"\b"
    return re.escape(word[:max(3, len(word) - 2)]) + r"[\w'\-]*"


def name_patterns(name):
    """How a name is looked for, in order: ("verbatim", the name folded), ("stem",
    its words by stem), ("gap", by stem across one parenthesis or cognomento phrase)."""
    words = [fold_map(w)[0] for w in name.split()]
    stems = [_word_pattern(w) for w in words]
    return [("verbatim", r"\b" + r"\s+".join(map(re.escape, words)) + r"\b"),
            ("stem", r"\b" + r"\s+".join(stems)),
            ("gap", r"\b" + WIDE_GAP.join(stems))]


def _gaps(matched):
    return matched.count("(") + matched.count("cognomento")


def find_person(text, name, taken=()):
    """The first free span of a person's name in `text`, how it was found
    ("verbatim", "stem", "gap"), and whether another free span matched at the
    same step; None when the name is not found. A match must open with a capital
    letter, so a common word is never marked ("pius" before "Pius")."""
    folded, index = fold_map(text)
    for how, pattern in name_patterns(name):
        spans = []
        for m in re.finditer(pattern, folded):
            if how == "gap" and _gaps(m.group(0)) > 1:
                continue
            span = to_print(index, m.start(), m.end())
            if text[span[0]].isupper() and free(span, taken):
                spans.append(span)
        if spans:
            return spans[0], how, len(spans) > 1
    return None


def partial_span(text, name, taken=()):
    """The first free capitalized match of a name's first word, by stem: where a
    curator starts from for a name not found whole. None when there is none."""
    folded, index = fold_map(text)
    for m in re.finditer(r"\b" + _word_pattern(fold_map(name.split()[0])[0]), folded):
        span = to_print(index, m.start(), m.end())
        if text[span[0]].isupper() and free(span, taken):
            return span
    return None
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_mentions_text -v`
Expected: 24 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/mentions_text.py tests/test_mentions_text.py
git commit -m "mentions: find a person's name by stem, across one parenthesis or cognomento"
```

---

### Task 4: One eulogy's mentions, with what to review

**Files:**
- Create: `scripts/extract_mentions.py`
- Test: `tests/test_extract_mentions.py`

**Interfaces:**
- Consumes: `find_place`, `back_ref_span`, `find_person`, `partial_span`, `free` (Tasks 1–3).
- Produces:
  - `where_key(where) -> str`, returning `"text"` or `"footnote:<n>"` (amendment 4).
  - `mention_order(m) -> tuple`
  - `eulogy_mentions(text, notes, places, persons, *, lang, place_qid, person_qid) -> (mentions, review, hows)`:
    - `mentions`: a list of internal dicts in code points, `{kind, where, start, end, form, [name], qid}`. `form` is the printed words, kept in memory only; `render_json` turns it into `check`;
    - `review`: a list of dicts `{"op", "kind", "where", "start", "end", "form", ["name"], "reasoning"}`, with `start`, `end` and `form` set to `None` when there is no span;
    - `hows`: a list of `(kind, in_text: bool, how)`.

- [ ] **Step 1: Write the failing tests**

`tests/test_extract_mentions.py`:

```python
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import extract_mentions as em  # noqa: E402

GAZETTEER = {"Cæsaréæ in Cappadócia": "Q48338", "Londínii in Anglia": "Q84"}
BASIL_TEXT = "Cæsaréæ in Cappadócia, commemorátio sancti Basilíi, magístri."
BASIL_PLACE = {"role": "burial", "la": "Cæsaréæ in Cappadócia", "it": "A Cesarea in Cappadocia", "source": "lead"}


def mentions_of(text, places=(), persons=(), notes=(), lang="la", qids=None):
    return em.eulogy_mentions(text, list(notes), list(places), list(persons), lang=lang,
                              place_qid=GAZETTEER.get, person_qid=lambda n: (qids or {}).get(n))


class EulogyMentionsTest(unittest.TestCase):
    def test_a_place_and_a_person(self):
        ms, review, hows = mentions_of(BASIL_TEXT, [BASIL_PLACE], [{"name": "Basilius", "where": "text"}],
                                       qids={"Basilius": "Q19546"})
        s = BASIL_TEXT.index("Basilíi")
        self.assertEqual(ms, [
            {"kind": "place", "where": "text", "start": 0, "end": 21, "form": "Cæsaréæ in Cappadócia", "qid": "Q48338"},
            {"kind": "person", "where": "text", "start": s, "end": s + 7, "form": "Basilíi", "name": "Basilius",
             "qid": "Q19546"},
        ])
        self.assertEqual(review, [])
        self.assertEqual(hows, [("place", True, "as printed"), ("person", True, "stem")])

    def test_an_italian_back_reference(self):
        place = {"role": "death", "la": "Londínii in Anglia", "it": "A Londra in Inghilterra", "source": "lead",
                 "via": "mr:0101-x"}
        ms, _, hows = mentions_of("Sempre a Londra, beato Tommaso, sacerdote.", [place], lang="it")
        self.assertEqual(ms, [{"kind": "place", "where": "text", "start": 0, "end": 15, "form": "Sempre a Londra",
                               "qid": "Q84"}])
        self.assertEqual(hows, [("place", True, "back-reference")])

    def test_a_place_without_a_form_in_this_language_is_not_expected(self):
        place = {"role": "death", "la": "Romæ", "source": "lead"}
        self.assertEqual(mentions_of("A Roma, san Nemo.", [place], lang="it")[:2], ([], []))

    def test_a_footnote_person(self):
        notes = ["Quorum nómina: Paulus Miki et Ioánnes Sóan."]
        ms, _, _ = mentions_of("Nagasáki, sanctórum Pauli Miki et sociórum.",
                               persons=[{"name": "Ioannes Soan", "where": {"footnote": 1}}], notes=notes)
        self.assertEqual(ms[0]["where"], {"footnote": 1})
        self.assertEqual(notes[0][ms[0]["start"]:ms[0]["end"]], "Ioánnes Sóan")

    def test_footnotes_count_from_one_in_printed_order_and_offsets_from_the_footnote(self):
        notes = ["Ioánnes Sóan, presbýter.", "Inter quos: Ioánnes Sóan et Thomas Kozáki."]
        ms, _, _ = mentions_of("Nagasáki, sanctórum mártyrum.",
                               persons=[{"name": "Thomas Kozaki", "where": {"footnote": 2}}], notes=notes)
        s = notes[1].index("Thomas")
        self.assertEqual((ms[0]["where"], ms[0]["start"], ms[0]["end"]), ({"footnote": 2}, s, s + len("Thomas Kozáki")))

    def test_longer_names_are_placed_first(self):
        text = "Romæ, beatórum Petri a Iesu María, presbýteri, et Maríæ, vírginis."
        ms, review, _ = mentions_of(text, persons=[{"name": "Maria", "where": "text"},
                                                   {"name": "Petrus a Iesu Maria", "where": "text"}])
        self.assertEqual([m["form"] for m in ms], ["Petri a Iesu María", "Maríæ"])
        self.assertEqual(review, [])

    def test_a_person_inside_a_place_phrase_is_reviewed_and_the_place_kept(self):
        text = "In civitáte Sancti Ioánnis, commemorátio sanctórum mártyrum."
        ms, review, _ = mentions_of(text, [{"role": "cult", "la": "In civitáte Sancti Ioánnis", "source": "lead"}],
                                    [{"name": "Ioannes", "where": "text"}])
        self.assertEqual([m["kind"] for m in ms], ["place"])
        self.assertEqual([(r["op"], r["kind"], r["form"]) for r in review], [
            ("add_mention", "person", "Ioánnis"), ("remove_mention", "place", "In civitáte Sancti Ioánnis")])

    def test_an_unfound_person_is_reviewed_with_its_best_partial_match(self):
        text = "Romæ, beáti Ioánnis a Cruce, presbýteri."
        ms, review, _ = mentions_of(text, persons=[{"name": "Ioannes Baptista", "where": "text"}])
        self.assertEqual(ms, [])
        self.assertEqual((review[0]["op"], review[0]["kind"], review[0]["name"], review[0]["form"]),
                         ("add_mention", "person", "Ioannes Baptista", "Ioánnis"))

    def test_a_person_with_no_match_at_all_has_no_span(self):
        _, review, _ = mentions_of("Romæ, sancti Nemo.", persons=[{"name": "Felix", "where": "text"}])
        self.assertEqual((review[0]["start"], review[0]["end"], review[0]["form"]), (None, None, None))

    def test_an_ambiguous_match_is_marked_and_reviewed(self):
        text = "Romæ, sanctórum Felícis presbýteri et Felícis diáconi."
        ms, review, _ = mentions_of(text, persons=[{"name": "Felix", "where": "text"}])
        self.assertEqual(len(ms), 1)
        self.assertEqual((review[0]["op"], review[0]["kind"], review[0]["start"]),
                         ("remove_mention", "person", ms[0]["start"]))

    def test_an_unfound_place_is_reviewed(self):
        ms, review, _ = mentions_of("Romæ, beáti Nemo.", [{"role": "death", "la": "Londínii in Anglia",
                                                           "source": "lead"}])
        self.assertEqual(ms, [])
        self.assertEqual((review[0]["op"], review[0]["kind"], review[0]["start"]), ("add_mention", "place", None))

    def test_where_key(self):
        self.assertEqual((em.where_key("text"), em.where_key({"footnote": 2})), ("text", "footnote:2"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: ERROR, `ModuleNotFoundError: No module named 'extract_mentions'`.

- [ ] **Step 3: Write the implementation**

`scripts/extract_mentions.py`. This task writes the module docstring, the imports and `eulogy_mentions`; Tasks 5–7 append to it.

```python
#!/usr/bin/env python3
"""Mark where each eulogy of the 2004 editions names its persons and places.

For the Latin editio altera 2004, the persons of data/persons.json and the
places of data/places.json; for the Italian (CEI) 2004 edition, the places.
Each mention is an offset span (UTF-16 code units, the unit JavaScript counts
in) in the eulogy's text or in one of its footnotes, with a `check` (a hash of
the printed words, never the words) and the Wikidata item crmedr has decided
for it (person_items.json, gazetteer.json). No text is stored: the words are
held in memory only (`form`) to match and validate. data/mentions_curated.json replaces
a eulogy's extracted mentions; the review change-set, which quotes the texts
around each doubtful mention, is written only outside the repository.
See martyrology-frontend's docs/superpowers/specs/2026-10-09-eulogy-markup-design.md.

  data/mentions.json          {"texts": {"commit"}, "editions": {edition: {id: [mention]}}}
  docs/mentions-report.md     counts and shares; IDs only

Usage:
  python3 extract_mentions.py /path/to/martyrology-texts --review /outside/the/repo/mentions-review.json [repo_root]
  python3 extract_mentions.py apply <exported.json> /path/to/martyrology-texts --review /outside/... [repo_root]

Standard library only.
"""

import datetime
import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

from extract_typology import load_texts
from mentions_text import back_ref_span, find_person, find_place, free, from_utf16, partial_span, utf16


def where_key(where):
    """A mention's `where` as a key and in change-set ids: "text" or "footnote:<n>"."""
    return "text" if where == "text" else f"footnote:{where['footnote']}"


def mention_order(m):
    """The text first, then the footnotes in order; within each, by start."""
    return (0 if m["where"] == "text" else m["where"]["footnote"], m["start"])


def eulogy_mentions(text, notes, places, persons, *, lang, place_qid, person_qid):
    """One eulogy's mentions in one edition (code-point offsets), what to review,
    and how each mention was found.

    `places`: the eulogy's items in data/places.json; `persons`: its names in
    data/persons.json (empty for an edition crmedr has no persons for); `notes`:
    the texts of its footnotes, in order. Places are placed first and win an
    overlap. Longer names are placed before shorter ones, so a name inside a
    longer name ("Maria" in "Petrus a Iesu Maria") is not marked there.
    """
    mentions, review, hows = [], [], []
    taken = {"place": {}, "person": {}}

    def source(where):
        if where == "text":
            return text
        n = where["footnote"]
        return notes[n - 1] if 1 <= n <= len(notes) else None

    def spans(kind, where):
        return taken[kind].setdefault(where_key(where), [])

    def add(kind, where, span, how, **extra):
        m = {"kind": kind, "where": where, "start": span[0], "end": span[1],
             "form": source(where)[span[0]:span[1]], **extra}
        mentions.append(m)
        spans(kind, where).append(span)
        hows.append((kind, where == "text", how))
        return m

    def ask(op, kind, where, span, reasoning, **extra):
        start, end = span if span else (None, None)
        review.append({"op": op, "kind": kind, "where": where, "start": start, "end": end,
                       "form": source(where)[start:end] if span else None, **extra, "reasoning": reasoning})

    for item in places:
        form = item.get(lang)
        if not form:
            continue
        span, how = find_place(text, form, spans("place", "text")), "as printed"
        if span is None and "via" in item:
            span, how = back_ref_span(text, lang), "back-reference"
        if span is None:
            ask("add_mention", "place", "text", None, f"the place as printed ({form}) was not found")
            continue
        add("place", "text", span, how, qid=place_qid(item["la"]))

    for p in sorted(persons, key=lambda p: -len(p["name"])):
        name, where = p["name"], p["where"]
        src = source(where)
        if src is None:
            continue  # extract_persons.py validates footnote numbers
        both = spans("place", where) + spans("person", where)
        found = find_person(src, name, both)
        if found:
            span, how, ambiguous = found
            add("person", where, span, how, name=name, qid=person_qid(name))
            if ambiguous:
                ask("remove_mention", "person", where, span, f"{name} matched more than once; this is the first match")
            continue
        inside = find_person(src, name, spans("person", where))
        if inside:
            place = next(x for x in mentions if x["kind"] == "place" and x["where"] == where
                         and not free(inside[0], [(x["start"], x["end"])]))
            ask("add_mention", "person", where, inside[0], f"{name} is named inside a place phrase, which was kept",
                name=name)
            ask("remove_mention", "place", where, (place["start"], place["end"]),
                f"the place phrase contains the person {name}")
            continue
        ask("add_mention", "person", where, partial_span(src, name, both), f"{name} was not found", name=name)

    mentions.sort(key=mention_order)
    return mentions, review, hows
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: 12 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_mentions.py tests/test_extract_mentions.py
git commit -m "mentions: one eulogy's persons and places, and what to review"
```

---

### Task 5: An edition, curated replacements, validation, `mentions.json` and the report

**Files:**
- Modify: `scripts/extract_mentions.py` (append)
- Create: `data/mentions_curated.json`
- Test: `tests/test_extract_mentions.py` (append)

**Interfaces:**
- Consumes: `eulogy_mentions`, `where_key`, `mention_order` (Task 4); `utf16`, `from_utf16`, `free` (Task 1).
- Produces:
  - `EDITIONS = {"martyrologium_romanum_2004": "la", "martyrologium_romanum_2004_it_IT": "it"}`, `PERSONS_EDITION`, `KINDS`, `MAX_FORM_WORDS = 20`
  - `source_text(edition_sources: tuple[dict, dict], eulogy, where) -> str | None`, where `edition_sources = (texts, notes)` and `notes` maps eulogy → list of footnote texts
  - `check(words: str) -> str`: `hashlib.sha256(words.encode("utf-8")).hexdigest()[:8]`
  - `from_file(m, src) -> dict`: a file-shaped mention (UTF-16, `check`) as an internal one (code points, `form`). `form` is `None` when the words at its span fail its `check`.
  - `build_edition(lang, texts, notes, places, persons, gazetteer, person_items, curated) -> (by_id, review_by_id, counts)`, where `curated` is that edition's `{eulogy: [file-shaped mention]}`
  - `validate(by_edition, source) -> list[str]`, where `source(edition, eulogy, where) -> str | None` and mentions are internal (code points, `form`)
  - `render_json(by_edition, source, commit) -> str`: writes `check`, never `form`
  - `render_report(counts_by_edition) -> str`
  - `texts_commit(texts_repo: Path) -> str | None`

- [ ] **Step 1: Write the failing tests (append to `tests/test_extract_mentions.py`, before `if __name__`)**

```python
ED = "martyrologium_romanum_2004"
PLACES = {"mr:0101-basilius": [BASIL_PLACE], "mr:0102-nemo": [{"role": "death", "la": "Romæ", "source": "lead"}]}
PERSONS = {"mr:0101-basilius": [{"name": "Basilius", "where": "text"}]}
ITEMS = {"mr:0101-basilius": {"Basilius": {"wikidata": "Q19546", "status": "auto"}}}
GAZ = {"Cæsaréæ in Cappadócia": {"wikidata": "Q48338", "status": "auto"}}


class BuildEditionTest(unittest.TestCase):
    def build(self, curated=None):
        return em.build_edition("la", {"mr:0101-basilius": BASIL_TEXT}, {}, PLACES, PERSONS, GAZ, ITEMS,
                                curated or {})

    def test_marks_counts_and_skips_eulogies_without_a_text(self):
        out, review, counts = self.build()
        self.assertEqual([m["form"] for m in out["mr:0101-basilius"]], ["Cæsaréæ in Cappadócia", "Basilíi"])
        self.assertEqual([m["qid"] for m in out["mr:0101-basilius"]], ["Q48338", "Q19546"])
        self.assertNotIn("mr:0102-nemo", out)
        self.assertEqual(counts["no_text"], ["mr:0102-nemo"])
        self.assertEqual(counts["expected"][("place", True)], 2)
        self.assertEqual(counts["found"][("person", True, "stem")], 1)

    def test_a_curated_eulogy_replaces_the_extraction_and_takes_its_qids(self):
        s = BASIL_TEXT.index("Basilíi")
        curated = {"mr:0101-basilius": [{"kind": "person", "where": "text", "start": s, "end": s + 7,
                                         "check": em.check("Basilíi"), "name": "Basilius", "qid": "Q1"}]}
        out, _, counts = self.build(curated)
        self.assertEqual(out["mr:0101-basilius"], [{"kind": "person", "where": "text", "start": s, "end": s + 7,
                                                    "form": "Basilíi", "name": "Basilius", "qid": "Q19546"}])
        self.assertEqual(counts["found"][("person", True, "curated")], 1)

    def test_a_curated_span_whose_check_fails_is_an_error(self):
        s = BASIL_TEXT.index("Basilíi")
        curated = {"mr:0101-basilius": [{"kind": "person", "where": "text", "start": s, "end": s + 7,
                                         "check": em.check("Basilii"), "name": "Basilius", "qid": None}]}
        out, _, _ = self.build(curated)
        errors = em.validate({ED: out}, lambda e, m, w: BASIL_TEXT)
        self.assertEqual(len(errors), 1)
        self.assertIn("mr:0101-basilius", errors[0])
        self.assertIn("does not pass its check", errors[0])


def person(start, end, form, name="Nemo"):
    return {"kind": "person", "where": "text", "start": start, "end": end, "form": form, "name": name, "qid": None}


class ValidateTest(unittest.TestCase):
    def errors(self, mentions, text="Romæ, sancti Nemínis."):
        return em.validate({"ed": {"mr:x": mentions}}, lambda e, m, w: text)

    def test_a_valid_mention(self):
        self.assertEqual(self.errors([person(13, 20, "Nemínis")]), [])

    def test_a_span_that_is_not_its_words_is_an_error(self):
        self.assertIn("does not pass its check", self.errors([person(0, 4, "Nemo")])[0])

    def test_overlaps_are_errors(self):
        self.assertIn("overlaps", self.errors([person(13, 20, "Nemínis"), person(13, 17, "Nemí")])[0])

    def test_a_person_needs_a_name_and_a_place_has_none(self):
        nameless = dict(person(13, 20, "Nemínis"), name=None)
        self.assertIn("a person needs a name", self.errors([nameless])[0])

    def test_a_missing_footnote_is_an_error(self):
        m = dict(person(0, 4, "Nemo"), where={"footnote": 3})
        errors = em.validate({"ed": {"mr:x": [m]}}, lambda e, mrid, w: None)
        self.assertIn("has no text", errors[0])


class CheckTest(unittest.TestCase):
    def test_check_is_sha256_of_the_utf8_printed_words(self):
        self.assertEqual(em.check("Cæsaréæ"), hashlib.sha256("Cæsaréæ".encode("utf-8")).hexdigest()[:8])
        self.assertNotEqual(em.check("Cæsaréæ"), em.check("Caesareae"))
        self.assertRegex(em.check("Basilíi"), r"^[0-9a-f]{8}$")

    def test_a_span_over_a_surrogate_pair(self):
        text = "\U0001D510 Nemo"
        doc = json.loads(em.render_json({"ed": {"mr:x": [dict(person(0, 1, "\U0001D510"), name="X")]}},
                                        lambda e, m, w: text, None))
        m = doc["editions"]["ed"]["mr:x"][0]
        self.assertEqual((m["start"], m["end"]), (0, 2))
        self.assertEqual(m["check"], hashlib.sha256("\U0001D510".encode("utf-8")).hexdigest()[:8])
        self.assertEqual(em.from_file(m, text)["form"], "\U0001D510")


class RenderTest(unittest.TestCase):
    def test_offsets_are_utf16_the_words_are_a_check_and_the_texts_commit_is_recorded(self):
        text = "\U0001D510 Nemo"
        doc = json.loads(em.render_json({"ed": {"mr:x": [person(2, 6, "Nemo")]}}, lambda e, m, w: text, "abc123"))
        self.assertEqual(list(doc), ["$comment", "texts", "editions"])
        self.assertEqual(doc["texts"], {"commit": "abc123"})
        m = doc["editions"]["ed"]["mr:x"][0]
        self.assertEqual((m["start"], m["end"], m["check"]), (3, 7, em.check("Nemo")))
        self.assertEqual(list(m), ["kind", "where", "start", "end", "check", "name", "qid"])

    def test_report(self):
        _, _, counts = em.build_edition("la", {"mr:0101-basilius": BASIL_TEXT}, {}, PLACES, PERSONS, GAZ, ITEMS, {})
        report = em.render_report({"martyrologium_romanum_2004": counts})
        self.assertIn("| Persons in the text | 1 | 1 | 100.0% | stem 1 |", report)
        self.assertIn("`mr:0102-nemo`", report)
        self.assertNotIn("Basilíi", report)

    def test_texts_commit_outside_git_is_none(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIsNone(em.texts_commit(Path(d)))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: the new tests ERROR with `AttributeError: module 'extract_mentions' has no attribute 'build_edition'` (or `'check'`, `'from_file'`, `'validate'`, `'render_json'`, `'render_report'`, `'texts_commit'`).

- [ ] **Step 3: Write the implementation (append to `scripts/extract_mentions.py`)**

```python
EDITIONS = {"martyrologium_romanum_2004": "la", "martyrologium_romanum_2004_it_IT": "it"}
PERSONS_EDITION = "martyrologium_romanum_2004"
KINDS = ("person", "place")
# A span covers one name or one place designation, never more: a guard against runaway matches.
MAX_FORM_WORDS = 20
COMMENT = ("Where each eulogy of the 2004 editions names its persons (Latin) and places (Latin and "
           "Italian): offsets in UTF-16 code units into the eulogy's text or its nth footnote (n from 1, "
           "in printed order), a check (the first 8 hex digits of the SHA-256 of the printed words, which "
           "are never stored), and the Wikidata item decided in person_items.json or gazetteer.json. "
           "texts.commit is the martyrology-texts commit the offsets were computed from. Generated by "
           "scripts/extract_mentions.py; corrections go in data/mentions_curated.json. Draft pending "
           "committee review.")
LABELS = [(("place", True), "Places in the text"), (("person", True), "Persons in the text"),
          (("person", False), "Persons in footnotes")]


def source_text(edition_sources, mrid, where):
    """The text a mention counts in: the eulogy's, or its nth footnote's. None when there is none."""
    texts, notes = edition_sources
    if where == "text":
        return texts.get(mrid)
    n = where.get("footnote") if isinstance(where, dict) else None
    ns = notes.get(mrid, [])
    return ns[n - 1] if isinstance(n, int) and 1 <= n <= len(ns) else None


def check(words):
    """The check stored for a mention: the first 8 hex digits of the SHA-256 of
    the printed words (UTF-8). It ties a span to its words without storing them."""
    return hashlib.sha256(words.encode("utf-8")).hexdigest()[:8]


def from_file(m, src):
    """A mention as the data files hold it (UTF-16 offsets, check) as an internal
    one (code points, the printed words in `form`). `form` is None when the words
    at its span do not pass its check: the text has changed since."""
    src = src or ""
    start, end = from_utf16(src, m["start"]), from_utf16(src, m["end"])
    words = src[start:end]
    out = {"kind": m["kind"], "where": m["where"], "start": start, "end": end,
           "form": words if words and check(words) == m.get("check") else None}
    if m["kind"] == "person":
        out["name"] = m.get("name")
    out["qid"] = m.get("qid")
    return out


def curated_mention(m, items, lang, place_qid, person_qid, source):
    """A curated mention as an internal one, its QID copied from the decisions: a
    person's by name; a place's from the eulogy's place whose printed form it is,
    else from its only place."""
    out = from_file(m, source(m["where"]))
    if m["kind"] == "person":
        out["qid"] = person_qid(m.get("name"))
    else:
        item = next((it for it in items if out["form"] is not None and it.get(lang) == out["form"]),
                    items[0] if len(items) == 1 else None)
        out["qid"] = place_qid(item["la"]) if item else None
    return out


def build_edition(lang, texts, notes, places, persons, gazetteer, person_items, curated):
    """One edition's mentions by eulogy (code points), its review items by eulogy, and its counts."""
    out, review = {}, {}
    counts = {"expected": Counter(), "found": Counter(), "review": Counter(), "no_text": []}

    def place_qid(la):
        return gazetteer.get(la, {}).get("wikidata")

    for mrid in sorted(set(places) | set(persons) | set(curated)):
        items, names = places.get(mrid, []), persons.get(mrid, [])
        counts["expected"][("place", True)] += sum(1 for it in items if it.get(lang))
        for p in names:
            counts["expected"][("person", p["where"] == "text")] += 1
        if mrid not in texts:
            counts["no_text"].append(mrid)
            continue
        decided = person_items.get(mrid, {})

        def person_qid(name, decided=decided):
            return decided.get(name, {}).get("wikidata")

        if mrid in curated:
            ms = [curated_mention(m, items, lang, place_qid, person_qid,
                                  lambda w: source_text((texts, notes), mrid, w)) for m in curated[mrid]]
            for m in ms:
                counts["found"][(m["kind"], m["where"] == "text", "curated")] += 1
        else:
            ms, rv, hows = eulogy_mentions(texts[mrid], notes.get(mrid, []), items, names, lang=lang,
                                           place_qid=place_qid, person_qid=person_qid)
            if rv:
                review[mrid] = rv
            counts["found"].update(hows)
            counts["review"].update(r["op"] for r in rv)
        if ms:
            out[mrid] = sorted(ms, key=mention_order)
    return out, review, counts


def validate(by_edition, source):
    """Errors in internal mentions (code points): each span holds its words (a
    curated one whose check failed has none), a span is short, a person has a name
    and a place none, no two overlap in one text."""
    errors = []
    for edition, by_id in by_edition.items():
        for mrid, ms in by_id.items():
            seen = {}
            for m in ms:
                tag = f"{edition} {mrid} {m.get('name') or m['kind']} at {where_key(m['where'])}:{m['start']}"
                if m.get("kind") not in KINDS:
                    errors.append(f"{tag}: unknown kind {m.get('kind')!r}")
                src = source(edition, mrid, m["where"])
                if src is None:
                    errors.append(f"{tag}: {where_key(m['where'])} has no text")
                    continue
                if (m.get("form") is None or not 0 <= m["start"] < m["end"] <= len(src)
                        or src[m["start"]:m["end"]] != m["form"]):
                    errors.append(f"{tag}: the span does not pass its check (has the text changed?)")
                    continue
                if len(m["form"].split()) > MAX_FORM_WORDS:
                    errors.append(f"{tag}: more than {MAX_FORM_WORDS} words")
                if (m["kind"] == "person") != bool(m.get("name")):
                    errors.append(f"{tag}: a person needs a name, and a place has none")
                span = (m["start"], m["end"])
                if not free(span, seen.get(where_key(m["where"]), [])):
                    errors.append(f"{tag}: overlaps another mention")
                seen.setdefault(where_key(m["where"]), []).append(span)
    return errors


def to_file(m, src):
    """An internal mention as the data files hold it: UTF-16 offsets and the
    check of its words in place of the words."""
    out = {"kind": m["kind"], "where": m["where"], "start": utf16(src, m["start"]), "end": utf16(src, m["end"]),
           "check": check(m["form"])}
    if m["kind"] == "person":
        out["name"] = m["name"]
    out["qid"] = m["qid"]
    return out


def to_utf16(by_edition, source):
    """The mentions as the data files hold them, eulogies sorted."""
    return {edition: {mrid: [to_file(m, source(edition, mrid, m["where"])) for m in by_id[mrid]]
                      for mrid in sorted(by_id)}
            for edition, by_id in by_edition.items()}


def render_json(by_edition, source, commit):
    doc = {"$comment": COMMENT, "texts": {"commit": commit}, "editions": to_utf16(by_edition, source)}
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


def render_report(counts_by_edition):
    """Counts and shares by edition; the IDs of the eulogies without a text. No text is quoted."""
    lines = ["# Mentions report", "",
             "Generated by `scripts/extract_mentions.py`: counts and eulogy IDs, no text. "
             "The doubtful mentions are in the review change-set, which is kept outside this repository.", ""]
    for edition, c in counts_by_edition.items():
        lines += [f"## {edition}", "", "| Mentions | Expected | Marked | Share | How |", "| --- | --- | --- | --- | --- |"]
        for key, label in LABELS:
            expected = c["expected"][key]
            if not expected:
                continue
            hows = {how: n for (kind, in_text, how), n in c["found"].items() if (kind, in_text) == key}
            marked = sum(hows.values())
            detail = ", ".join(f"{how} {n}" for how, n in sorted(hows.items()))
            lines.append(f"| {label} | {expected} | {marked} | {100 * marked / expected:.1f}% | {detail} |")
        ops = ", ".join(f"{op} {n}" for op, n in sorted(c["review"].items())) or "none"
        lines += ["", f"Review operations: {ops}.", ""]
        if c["no_text"]:
            lines += ["Eulogies with persons or places but no text of their own in this edition: "
                      + ", ".join(f"`{m}`" for m in c["no_text"]) + ".", ""]
    return "\n".join(lines)


def texts_commit(texts_repo):
    """The martyrology-texts commit checked out at `texts_repo`; None when it is not a git checkout."""
    try:
        out = subprocess.run(["git", "-C", str(texts_repo), "rev-parse", "HEAD"],
                             capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return out.stdout.strip() or None
```

`data/mentions_curated.json`:

```json
{
  "$comment": "Curators' corrections to data/mentions.json: for each eulogy listed, its complete list of mentions in the shape of data/mentions.json (UTF-16 offsets and a check, never the words), replacing the extraction. QIDs are copied from person_items.json and gazetteer.json at extraction, whatever is written here. Written by `scripts/extract_mentions.py apply` from a reviewed change-set (docs/mentions-changeset.md), or by hand.",
  "editions": {}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: 25 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_mentions.py tests/test_extract_mentions.py data/mentions_curated.json
git commit -m "mentions: an edition's mentions, curated replacements, validation, output and report"
```

---

### Task 6: The review change-set and the command line

**Files:**
- Modify: `scripts/extract_mentions.py` (append)
- Modify: `.gitignore`
- Test: `tests/test_extract_mentions.py` (append)

**Interfaces:**
- Consumes: everything in Tasks 4–5; `extract_typology.load_texts`.
- Produces:
  - `context(src, start, end) -> tuple[str, int]`, returning (context, its code-point start)
  - `review_ops(edition, review_by_id, source) -> list[dict]`. Each op has its keys in this order:
    - `add_mention`: `op`, `id`, `edition`, `eulogy`, `where`, `start`, `end`, `form`, `kind`, [`name`], `context`, `context_start`, `reasoning`, `decision`, `edited`
    - `remove_mention`: the same, without `name` and `edited`
  - `new_changeset(operations) -> dict`
  - `load_edition(texts_repo, edition) -> (texts, notes)`
  - `extract(texts_repo, repo_root, review_path) -> None`
  - `main(argv) -> None`

- [ ] **Step 1: Write the failing tests (append to `tests/test_extract_mentions.py`)**

```python
CRUCE = "Romæ, beáti Ioánnis a Cruce, presbýteri."


class ReviewOpsTest(unittest.TestCase):
    def test_an_add_with_a_span(self):
        s = CRUCE.index("Ioánnis")
        review = {"mr:x": [{"op": "add_mention", "kind": "person", "where": "text", "start": s, "end": s + 7,
                            "form": "Ioánnis", "name": "Ioannes Baptista", "reasoning": "Ioannes Baptista was not found"}]}
        op = em.review_ops(ED, review, lambda e, m, w: CRUCE)[0]
        self.assertEqual(list(op), ["op", "id", "edition", "eulogy", "where", "start", "end", "form", "kind", "name",
                                    "context", "context_start", "reasoning", "decision", "edited"])
        self.assertEqual(op["id"], f"{ED}|mr:x|text|{s}")
        self.assertEqual(op["context"][op["start"] - op["context_start"]:][:7], "Ioánnis")
        self.assertEqual((op["decision"], op["edited"]), (None, None))

    def test_an_add_without_a_span_quotes_the_whole_text_and_ends_its_id_with_the_name(self):
        notes = "Quorum nómina: Paulus et Ioánnes."
        review = {"mr:x": [{"op": "add_mention", "kind": "person", "where": {"footnote": 2}, "start": None,
                            "end": None, "form": None, "name": "Felix", "reasoning": "Felix was not found"}]}
        op = em.review_ops(ED, review, lambda e, m, w: notes)[0]
        self.assertEqual(op["id"], f"{ED}|mr:x|footnote:2|Felix")
        self.assertEqual((op["start"], op["end"], op["form"], op["context"], op["context_start"]),
                         (None, None, None, notes, 0))

    def test_a_remove_has_a_kind_and_no_edited(self):
        review = {"mr:x": [{"op": "remove_mention", "kind": "place", "where": "text", "start": 0, "end": 4,
                            "form": "Romæ", "reasoning": "x"}]}
        op = em.review_ops(ED, review, lambda e, m, w: CRUCE)[0]
        self.assertEqual(op["kind"], "place")
        self.assertNotIn("edited", op)
        self.assertNotIn("name", op)

    def test_the_context_is_words_around_the_span(self):
        text = "Alpha beta gamma delta " * 6 + "Nemo" + " epsilon zeta eta theta" * 6
        s = text.index("Nemo")
        ctx, at = em.context(text, s, s + 4)
        self.assertTrue(0 < at < s and s + 4 < at + len(ctx) < len(text))
        self.assertEqual(text[at:at + len(ctx)], ctx)
        self.assertEqual(text[at - 1], " ")


def write(path, doc):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")


ALLOWED_STRINGS = {"kind", "qid", "name", "check", "where"}


def no_printed_words(doc):
    """Every string value of a mentions file that is not an id, QID, name, kind,
    check or where ("text"): the policy test. `form` must never appear."""
    found = []

    def walk(node, key=None):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "form":
                    found.append(("form", v))
                elif k not in ("$comment", "commit"):
                    walk(v, k)
        elif isinstance(node, list):
            for v in node:
                walk(v, key)
        elif isinstance(node, str) and key not in ALLOWED_STRINGS:
            found.append((key, node))

    walk(doc)
    return found


def fixture(root):
    """A crmedr root and a texts checkout with one Latin and one Italian eulogy."""
    repo, texts = root / "crmedr", root / "texts"
    write(repo / "data" / "places.json", {"places": PLACES})
    write(repo / "data" / "persons.json", {"editions": {ED: PERSONS}})
    write(repo / "data" / "gazetteer.json", {"places": GAZ})
    write(repo / "data" / "person_items.json", {"persons": ITEMS})
    (repo / "docs").mkdir(parents=True)
    for edition, text in ((ED, BASIL_TEXT), ("martyrologium_romanum_2004_it_IT",
                                             "A Cesarea in Cappadocia, san Basilio, vescovo.")):
        for month in range(1, 13):
            write(texts / "data" / "editions" / edition / f"{month:02d}.json",
                  {"mr:0101-basilius": text} if month == 1 else {})
    return repo, texts


class MainTest(unittest.TestCase):
    def test_writes_mentions_report_and_review(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            review = Path(d) / "private" / "mentions-review.json"
            review.parent.mkdir()
            em.main([str(texts), str(repo), "--review", str(review)])
            doc = json.loads((repo / "data" / "mentions.json").read_text(encoding="utf-8"))
            self.assertEqual(doc["texts"], {"commit": None})
            self.assertEqual([m["check"] for m in doc["editions"][ED]["mr:0101-basilius"]],
                             [em.check("Cæsaréæ in Cappadócia"), em.check("Basilíi")])
            self.assertEqual([m["check"] for m in doc["editions"]["martyrologium_romanum_2004_it_IT"]["mr:0101-basilius"]],
                             [em.check("A Cesarea in Cappadocia")])
            self.assertTrue((repo / "docs" / "mentions-report.md").exists())
            changeset = json.loads(review.read_text(encoding="utf-8"))
            self.assertEqual((changeset["schema"], changeset["operations"]), ("crmedr-changeset/v1", []))

    def test_mentions_json_holds_no_printed_words(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            em.main([str(texts), str(repo), "--review", str(Path(d) / "mentions-review.json")])
            doc = json.loads((repo / "data" / "mentions.json").read_text(encoding="utf-8"))
            self.assertEqual(no_printed_words(doc), [])
            self.assertEqual(doc["editions"][ED]["mr:0101-basilius"][1]["check"], em.check("Basilíi"))

    def test_the_review_path_is_required(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            with self.assertRaises(SystemExit):
                em.main([str(texts), str(repo)])
            self.assertFalse((repo / "data" / "mentions.json").exists())

    def test_a_review_path_inside_the_repository_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            with self.assertRaises(SystemExit) as cm:
                em.main([str(texts), str(repo), "--review", str(repo / "data" / "mentions-review.json")])
            self.assertIn("outside the repository", str(cm.exception.code))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: the new tests ERROR with `AttributeError: module 'extract_mentions' has no attribute 'review_ops'` (or `'context'`, `'main'`).

- [ ] **Step 3: Write the implementation (append to `scripts/extract_mentions.py`)**

```python
SCHEMA = "crmedr-changeset/v1"
CONTEXT_WIDTH = 40


def _read(path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def context(src, start, end):
    """The words around a span and the code-point offset at which they start in
    `src`: about CONTEXT_WIDTH characters either side, cut at spaces."""
    a = max(0, start - CONTEXT_WIDTH)
    if a > 0:
        space = src.find(" ", a, start)
        a = space + 1 if space >= 0 else a
    b = min(len(src), end + CONTEXT_WIDTH)
    if b < len(src):
        space = src.rfind(" ", end, b)
        b = space if space > end else b
    return src[a:b], a


def review_ops(edition, review_by_id, source):
    """The review items of one edition as change-set operations (UTF-16 offsets).
    An item without a span quotes the whole text it is about (context_start 0)."""
    ops, seen = [], set()
    for mrid in sorted(review_by_id):
        for r in review_by_id[mrid]:
            src = source(edition, mrid, r["where"])
            if r["start"] is None:
                ctx, at, start, end = src, 0, None, None
            else:
                ctx, at = context(src, r["start"], r["end"])
                start, end = utf16(src, r["start"]), utf16(src, r["end"])
            key = r.get("name") if start is None else start
            op_id = f"{edition}|{mrid}|{where_key(r['where'])}|{key}"
            if op_id in seen:  # a remove and an add at one offset
                op_id += f"|{r['op']}"
            seen.add(op_id)
            op = {"op": r["op"], "id": op_id, "edition": edition, "eulogy": mrid, "where": r["where"],
                  "start": start, "end": end, "form": r["form"], "kind": r["kind"]}
            if r["op"] == "add_mention" and r["kind"] == "person":
                op["name"] = r["name"]
            op.update(context=ctx, context_start=utf16(src, at), reasoning=r["reasoning"], decision=None)
            if r["op"] == "add_mention":
                op["edited"] = None
            ops.append(op)
    return ops


def new_changeset(operations):
    return {"schema": SCHEMA, "generated_by": "scripts/extract_mentions.py",
            "generated_at": datetime.date.today().isoformat(),
            "base": {"edition": PERSONS_EDITION, "registry": "data/mentions.json"}, "operations": operations}


def load_edition(texts_repo, edition):
    """An edition's texts, and its footnotes' texts by eulogy (none for an edition without footnotes.json)."""
    notes = _read(texts_repo / "data" / "editions" / edition / "footnotes.json", {})
    return load_texts(texts_repo, edition), {k: [f["text"] for f in v] for k, v in notes.items()}


def extract(texts_repo, repo_root, review_path):
    data = repo_root / "data"
    places = _read(data / "places.json")["places"]
    persons = _read(data / "persons.json")["editions"][PERSONS_EDITION]
    gazetteer = _read(data / "gazetteer.json", {"places": {}})["places"]
    person_items = _read(data / "person_items.json", {"persons": {}})["persons"]
    curated = _read(data / "mentions_curated.json", {"editions": {}})["editions"]
    sources, by_edition, review, counts = {}, {}, {}, {}
    for edition, lang in EDITIONS.items():
        sources[edition] = load_edition(texts_repo, edition)
        by_edition[edition], review[edition], counts[edition] = build_edition(
            lang, *sources[edition], places, persons if edition == PERSONS_EDITION else {},
            gazetteer, person_items, curated.get(edition, {}))

    def source(edition, mrid, where):
        return source_text(sources[edition], mrid, where)

    errors = validate(by_edition, source)
    if errors:
        sys.exit("invalid mentions:\n" + "\n".join(errors))
    (data / "mentions.json").write_text(render_json(by_edition, source, texts_commit(texts_repo)), encoding="utf-8")
    (repo_root / "docs" / "mentions-report.md").write_text(render_report(counts), encoding="utf-8")
    ops = [op for edition in EDITIONS for op in review_ops(edition, review[edition], source)]
    review_path.write_text(json.dumps(new_changeset(ops), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(len(ms) for by_id in by_edition.values() for ms in by_id.values())
    print(f"wrote data/mentions.json: {total} mentions; {len(ops)} to review in {review_path}")


def main(argv):
    if "--review" not in argv or argv.index("--review") + 1 >= len(argv):
        sys.exit(__doc__)
    i = argv.index("--review")
    review_path, argv = Path(argv[i + 1]), argv[:i] + argv[i + 2:]
    exported = None
    if argv[:1] == ["apply"]:
        if len(argv) < 3:
            sys.exit(__doc__)
        exported, argv = _read(Path(argv[1])), argv[2:]
    if not argv:
        sys.exit(__doc__)
    texts_repo = Path(argv[0])
    repo_root = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent
    if review_path.resolve().is_relative_to(repo_root.resolve()):
        sys.exit("the review change-set quotes the 2004 texts: write it outside the repository "
                 "(martyrology-frontend's CHANGESETS_DIR)")
    if exported is not None:
        print(f"applied {apply(exported, texts_repo, repo_root)} decisions")
    extract(texts_repo, repo_root, review_path)


if __name__ == "__main__":
    main(sys.argv[1:])
```

In `.gitignore`, append:

```
# Quotes the 2004 texts: written by extract_mentions.py --review outside the repository, never committed.
mentions-review.json
```

`main` refers to `apply`, which Task 7 defines. The Task 6 tests never take that branch, but add this placeholder now so the module imports cleanly, and replace it in Task 7:

```python
def apply(exported, texts_repo, repo_root):
    raise NotImplementedError
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: 33 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_mentions.py tests/test_extract_mentions.py .gitignore
git commit -m "mentions: the review change-set, outside the repository, and the command line"
```

---

### Task 7: `apply`: accepted decisions into `mentions_curated.json`

**Files:**
- Modify: `scripts/extract_mentions.py`: replace the `apply` placeholder and add `apply_decisions`
- Test: `tests/test_extract_mentions.py` (append)

**Interfaces:**
- Consumes: `_read`, `load_edition`, `source_text`, `validate`, `mention_order`, `EDITIONS` (Tasks 5–6); `from_utf16`.
- Produces:
  - `MENTION_OPS = {"add_mention", "set_span", "remove_mention"}`
  - `apply_decisions(curated_editions, mentions_editions, exported) -> (applied: int, errors: list[str])`:
    - It works entirely in UTF-16, on file-shaped mentions.
    - A mention an operation adds or moves carries the op's `form` and no `check`, until `apply` checks it against the texts.
    - `set_span` carries `"from": {"start", "end"}` and `"to": {"start", "end", "form"}`; `edited` is `{start, end, form}`.
  - `apply(exported, texts_repo, repo_root) -> int`:
    - For each such pending mention, it checks that the text at the span is the op's `form`, then stores `check` (computed from the texts) in place of `form`.
    - It writes `data/mentions_curated.json`; the caller then runs `extract`.

- [ ] **Step 1: Write the failing tests (append)**

```python
def stored(kind, start, end, words, name=None, qid=None):
    """A mention as the data files hold it (UTF-16 offsets, check)."""
    m = {"kind": kind, "where": "text", "start": start, "end": end, "check": em.check(words)}
    if kind == "person":
        m["name"] = name
    m["qid"] = qid
    return m


class ApplyDecisionsTest(unittest.TestCase):
    MENTIONS = {ED: {"mr:x": [stored("place", 0, 4, "Romæ", qid="Q220"), stored("person", 13, 20, "Nemínis", "Nemo")]}}

    def op(self, op, decision="accept", **kw):
        return {"op": op, "edition": ED, "eulogy": "mr:x", "where": "text", "decision": decision, **kw}

    def test_accept_remove_edit_add_and_ignore_the_rest(self):
        exported = {"operations": [
            self.op("remove_mention", kind="person", start=13, end=20, form="Nemínis"),
            self.op("add_mention", "edit", kind="person", name="Nemo", start=None, end=None, form=None,
                    edited={"start": 13, "end": 17, "form": "Nemí"}),
            self.op("remove_mention", "reject", kind="place", start=0, end=4, form="Romæ"),
            {"op": "resolve_person", "decision": "accept"},
        ]}
        curated = {}
        applied, errors = em.apply_decisions(curated, self.MENTIONS, exported)
        self.assertEqual((applied, errors), (2, []))
        self.assertEqual([(m["start"], m.get("name")) for m in curated[ED]["mr:x"]], [(0, None), (13, "Nemo")])
        # The added mention waits for apply to check it against the texts.
        self.assertEqual((curated[ED]["mr:x"][1]["form"], "check" in curated[ED]["mr:x"][1]), ("Nemí", False))
        self.assertEqual(len(self.MENTIONS[ED]["mr:x"]), 2)  # the input is not changed

    def test_set_span_with_an_edit(self):
        exported = {"operations": [self.op("set_span", "edit", kind="place", **{"from": {"start": 0, "end": 4},
                                            "to": {"start": 0, "end": 3, "form": "Rom"}},
                                            edited={"start": 0, "end": 5, "form": "Romæ,"})]}
        curated = {}
        em.apply_decisions(curated, self.MENTIONS, exported)
        moved = curated[ED]["mr:x"][0]
        self.assertEqual((moved["start"], moved["end"], moved["form"], "check" in moved), (0, 5, "Romæ,", False))

    def test_an_added_mention_needs_a_span(self):
        exported = {"operations": [self.op("add_mention", kind="person", name="Felix", start=None, end=None,
                                           form=None)]}
        applied, errors = em.apply_decisions({}, self.MENTIONS, exported)
        self.assertEqual(applied, 0)
        self.assertIn("needs a span", errors[0])

    def test_a_curated_eulogy_is_edited_where_it_stands(self):
        curated = {ED: {"mr:x": [stored("place", 0, 4, "Romæ")]}}
        em.apply_decisions(curated, self.MENTIONS, {"operations": [
            self.op("remove_mention", kind="place", start=0, end=4, form="Romæ")]})
        self.assertEqual(curated[ED]["mr:x"], [])


class ApplyCommandTest(unittest.TestCase):
    def test_apply_writes_the_curated_file_and_extracts_again(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            review = Path(d) / "mentions-review.json"
            em.main([str(texts), str(repo), "--review", str(review)])
            s = BASIL_TEXT.index("Basilíi")
            exported = Path(d) / "exported.json"
            write(exported, {"operations": [{"op": "remove_mention", "edition": ED, "eulogy": "mr:0101-basilius",
                                             "where": "text", "kind": "person", "start": s, "end": s + 7,
                                             "form": "Basilíi", "decision": "accept"}]})
            em.main(["apply", str(exported), str(texts), str(repo), "--review", str(review)])
            curated = json.loads((repo / "data" / "mentions_curated.json").read_text(encoding="utf-8"))
            self.assertEqual([m["kind"] for m in curated["editions"][ED]["mr:0101-basilius"]], ["place"])
            self.assertEqual(no_printed_words(curated), [])
            doc = json.loads((repo / "data" / "mentions.json").read_text(encoding="utf-8"))
            self.assertEqual([m["kind"] for m in doc["editions"][ED]["mr:0101-basilius"]], ["place"])

    def test_apply_computes_the_check_from_the_texts(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            review = Path(d) / "mentions-review.json"
            em.main([str(texts), str(repo), "--review", str(review)])
            s = BASIL_TEXT.index("Basilíi")
            exported = Path(d) / "exported.json"
            write(exported, {"operations": [{"op": "set_span", "edition": ED, "eulogy": "mr:0101-basilius",
                                             "where": "text", "kind": "person", "from": {"start": s, "end": s + 7},
                                             "to": {"start": s, "end": s + 8, "form": "Basilíi,"},
                                             "decision": "accept"}]})
            em.main(["apply", str(exported), str(texts), str(repo), "--review", str(review)])
            curated = json.loads((repo / "data" / "mentions_curated.json").read_text(encoding="utf-8"))
            moved = curated["editions"][ED]["mr:0101-basilius"][1]
            self.assertEqual((moved["end"], moved["check"]), (s + 8, em.check("Basilíi,")))
            self.assertEqual(no_printed_words(curated), [])

    def test_an_apply_that_breaks_a_span_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            repo, texts = fixture(Path(d))
            exported = Path(d) / "exported.json"
            write(exported, {"operations": [{"op": "add_mention", "edition": ED, "eulogy": "mr:0101-basilius",
                                             "where": "text", "kind": "person", "name": "Nemo", "start": 0,
                                             "end": 4, "form": "Nemo", "decision": "accept"}]})
            with self.assertRaises(SystemExit):
                em.main(["apply", str(exported), str(texts), str(repo), "--review", str(Path(d) / "r.json")])
            self.assertFalse((repo / "data" / "mentions_curated.json").exists())
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected:
- the `ApplyDecisionsTest` tests ERROR with `AttributeError: ... 'apply_decisions'`;
- the `ApplyCommandTest` tests ERROR with `NotImplementedError` (raised by the Task 6 placeholder).

- [ ] **Step 3: Write the implementation (replace the placeholder `apply` with this block)**

```python
MENTION_OPS = {"add_mention", "set_span", "remove_mention"}
CURATED_COMMENT = ("Curators' corrections to data/mentions.json: for each eulogy listed, its complete list of "
                   "mentions in the shape of data/mentions.json (UTF-16 offsets and a check, never the words), "
                   "replacing the extraction. "
                   "QIDs are copied from person_items.json and gazetteer.json at extraction, whatever is written "
                   "here. Written by `scripts/extract_mentions.py apply` from a reviewed change-set "
                   "(docs/mentions-changeset.md), or by hand.")


def _same(m, where, start, end):
    return m["where"] == where and m["start"] == start and m["end"] == end


def apply_decisions(curated_editions, mentions_editions, exported):
    """Apply the accepted (or edited) mention operations of `exported` to the
    eulogies they touch, in UTF-16 offsets: each eulogy starts from its curated
    entry, else from data/mentions.json, and is written back into
    `curated_editions`. Returns how many operations were applied, and errors."""
    applied, errors = 0, []
    for op in exported.get("operations", []):
        if op.get("op") not in MENTION_OPS or op.get("decision") not in ("accept", "edit"):
            continue
        edition, mrid, where = op["edition"], op["eulogy"], op["where"]
        edited = (op.get("edited") or {}) if op["decision"] == "edit" else {}
        by_id = curated_editions.setdefault(edition, {})
        current = [dict(m) for m in by_id.get(mrid, mentions_editions.get(edition, {}).get(mrid, []))]
        if op["op"] == "add_mention":
            span = {k: edited.get(k, op.get(k)) for k in ("start", "end", "form")}
            if span["start"] is None or span["end"] is None or not span["form"]:
                errors.append(f"{op.get('id', mrid)}: an added mention needs a span")
                continue
            # `form` waits here for apply() to check it against the texts and store its check instead.
            m = {"kind": op["kind"], "where": where, **span}
            if op["kind"] == "person":
                m["name"] = op["name"]
            m["qid"] = None  # copied from the decisions at extraction
            current.append(m)
        elif op["op"] == "remove_mention":
            current = [m for m in current if not _same(m, where, op["start"], op["end"])]
        else:
            to = {**op["to"], **edited}
            for m in current:
                if _same(m, where, op["from"]["start"], op["from"]["end"]):
                    m.pop("check", None)
                    m.update(start=to["start"], end=to["end"], form=to["form"])
        by_id[mrid] = sorted(current, key=mention_order)
        applied += 1
    return applied, errors


def apply(exported, texts_repo, repo_root):
    """Write the eulogies the accepted operations of `exported` touch into
    data/mentions_curated.json, after checking every curated span against the
    texts. Nothing is written when one fails."""
    data = repo_root / "data"
    mentions = _read(data / "mentions.json", {"editions": {}})["editions"]
    doc = _read(data / "mentions_curated.json", {"$comment": CURATED_COMMENT, "editions": {}})
    applied, errors = apply_decisions(doc["editions"], mentions, exported)
    sources = {edition: load_edition(texts_repo, edition) for edition in doc["editions"] if edition in EDITIONS}
    errors += [f"{edition}: not an edition with mentions" for edition in doc["editions"] if edition not in EDITIONS]

    def source(edition, mrid, where):
        return source_text(sources[edition], mrid, where)

    for edition, by_id in doc["editions"].items():
        for mrid, ms in by_id.items():
            for m in ms:
                if "form" not in m or edition not in EDITIONS:
                    continue
                src = source(edition, mrid, m["where"]) or ""
                words = src[from_utf16(src, m["start"]):from_utf16(src, m["end"])]
                if words != m.pop("form"):
                    errors.append(f"{edition} {mrid} {where_key(m['where'])}:{m['start']}: "
                                  "the text at the span is not the words the operation names")
                m["check"] = check(words)
                # key order as in data/mentions.json
                m_sorted = {k: m[k] for k in ("kind", "where", "start", "end", "check", "name", "qid") if k in m}
                m.clear()
                m.update(m_sorted)
    in_code_points = {edition: {mrid: [from_file(m, source(edition, mrid, m["where"])) for m in ms]
                                for mrid, ms in by_id.items()}
                      for edition, by_id in doc["editions"].items() if edition in EDITIONS}
    errors += validate(in_code_points, source)
    if errors:
        sys.exit("not applied:\n" + "\n".join(errors))
    (data / "mentions_curated.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                                                encoding="utf-8")
    return applied
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_extract_mentions -v`
Expected: 40 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_mentions.py tests/test_extract_mentions.py
git commit -m "mentions: apply reviewed decisions into mentions_curated.json"
```

---

### Task 8: The Wikidata client: life dates, descriptions and sitelinks, Commons credits

**Files:**
- Modify: `scripts/wikidata.py`: add the constants after `EXTRA_COUNTRY_ISO`, `life_date` after `summarize_person`, and two methods in `class Wikidata` after `person`
- Test: `tests/test_person_details.py` (create)

**Interfaces:**
- Consumes: `_value`, `Wikidata._api`, `Wikidata._get`.
- Produces:
  - `DETAIL_LANGS = ("en", "it", "fr", "de", "es", "pt")`
  - `COMMONS_API`
  - `CIRCA = "Q5727902"`
  - `life_date(claims, prop) -> {"year": int, "precision": "year" | "decade" | "century", "circa": bool} | None`
  - `Wikidata.details_entities(qids: list[str]) -> dict[qid, raw]` (no `missing` items)
  - `Wikidata.commons_files(files: list[str]) -> dict[file, extmetadata]`, keyed by the name as given

- [ ] **Step 1: Write the failing tests**

`tests/test_person_details.py`:

```python
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import wikidata as wd  # noqa: E402


def claim(time, precision=9, rank="normal", circa=False):
    c = {"rank": rank, "mainsnak": {"datavalue": {"value": {"time": time, "precision": precision}}}}
    if circa:
        c["qualifiers"] = {"P1480": [{"datavalue": {"value": {"id": "Q5727902"}}}]}
    return c


def life(time, precision=9, circa=False):
    return wd.life_date({"P569": [claim(time, precision, circa=circa)]}, "P569")


class LifeDateTest(unittest.TestCase):
    def test_a_day_or_a_year_is_a_year(self):
        self.assertEqual(life("+1597-02-05T00:00:00Z", 11), {"year": 1597, "precision": "year", "circa": False})
        self.assertEqual(life("+0329-00-00T00:00:00Z"), {"year": 329, "precision": "year", "circa": False})

    def test_decade_and_century(self):
        self.assertEqual(life("+0330-00-00T00:00:00Z", 8)["precision"], "decade")
        self.assertEqual(life("+0400-00-00T00:00:00Z", 7), {"year": 400, "precision": "century", "circa": False})

    def test_coarser_than_a_century_is_unknown(self):
        self.assertIsNone(life("+1000-00-00T00:00:00Z", 6))

    def test_circa(self):
        self.assertTrue(life("+0329-00-00T00:00:00Z", circa=True)["circa"])

    def test_bce_is_negative(self):
        self.assertEqual(life("-0100-00-00T00:00:00Z")["year"], -100)

    def test_preferred_first_deprecated_never(self):
        claims = {"P570": [claim("+0400-00-00T00:00:00Z", rank="deprecated"), claim("+0379-00-00T00:00:00Z"),
                           claim("+0378-00-00T00:00:00Z", rank="preferred")]}
        self.assertEqual(wd.life_date(claims, "P570")["year"], 378)

    def test_the_old_date_helper_is_unchanged(self):
        self.assertEqual(wd._date({"P569": [claim("+0329-00-00T00:00:00Z")]}, "P569"), "0329")

    def test_undated(self):
        self.assertIsNone(wd.life_date({}, "P569"))
        self.assertIsNone(wd.life_date({"P569": [{"mainsnak": {"snaktype": "somevalue"}}]}, "P569"))


class DetailsClientTest(unittest.TestCase):
    def test_entities_and_commons(self):
        urls = []

        def fetch(url):
            urls.append(url)
            if url.startswith(wd.COMMONS_API):
                return {"query": {"normalized": [{"from": "File:Basil_of_Caesarea.jpg",
                                                  "to": "File:Basil of Caesarea.jpg"}],
                                  "pages": {"1": {"title": "File:Basil of Caesarea.jpg", "imageinfo": [
                                      {"extmetadata": {"LicenseShortName": {"value": "Public domain"}}}]},
                                            "-1": {"title": "File:Gone.jpg", "missing": ""}}}}
            return {"entities": {"Q19546": {"id": "Q19546", "descriptions": {}, "claims": {}, "sitelinks": {}},
                                 "Q404": {"id": "Q404", "missing": ""}}}

        with tempfile.TemporaryDirectory() as d:
            client = wd.Wikidata(Path(d), fetch=fetch)
            self.assertEqual(list(client.details_entities(["Q19546", "Q404"])), ["Q19546"])
            self.assertIn("sitefilter=enwiki%7Citwiki%7Cfrwiki%7Cdewiki%7Ceswiki%7Cptwiki", urls[0])
            self.assertIn("props=descriptions%7Cclaims%7Csitelinks", urls[0])
            self.assertEqual(client.commons_files(["Basil_of_Caesarea.jpg", "Gone.jpg"]),
                             {"Basil_of_Caesarea.jpg": {"LicenseShortName": {"value": "Public domain"}}})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_person_details -v`
Expected: ERROR, `AttributeError: module 'wikidata' has no attribute 'life_date'` (and `'COMMONS_API'`).

- [ ] **Step 3: Write the implementation**

In `scripts/wikidata.py`, after `EXTRA_COUNTRY_ISO = {"Q55": "NL"}`:

```python
# The interface languages of martyrology-frontend, for the reader's person popups.
DETAIL_LANGS = ("en", "it", "fr", "de", "es", "pt")
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
# P1480 (sourcing circumstances) = circa.
CIRCA = "Q5727902"
```

Add `import re` to the imports (it has none). After `summarize_person`:

```python
# Wikidata time precision: 9 year (10 month and 11 day read as the year), 8 decade, 7 century.
LIFE_PRECISION = {8: "decade", 7: "century"}
YEAR = re.compile(r"([+-]?)(\d+)-")


def life_date(claims, prop):
    """The best dated value of `prop` for the reader: its year (negative before
    Christ), its precision ("year", "decade" or "century") and whether a P1480
    qualifier says circa. Preferred statements first, deprecated ones never, and
    one coarser than a century skipped; None when nothing is left. Unlike _date,
    which the review cards use, it keeps precision and circa apart."""
    ranked = sorted((c for c in claims.get(prop, []) if c.get("rank") != "deprecated"),
                    key=lambda c: c.get("rank") != "preferred")
    for c in ranked:
        v = _value(c)
        if not (isinstance(v, dict) and "time" in v):
            continue
        p = v.get("precision", 9)
        m = YEAR.match(v["time"])
        if p < 7 or not m:
            continue
        quals = c.get("qualifiers", {}).get("P1480", [])
        circa = any((q.get("datavalue", {}).get("value") or {}).get("id") == CIRCA for q in quals)
        year = int(m.group(2)) * (-1 if m.group(1) == "-" else 1)
        return {"year": year, "precision": "year" if p >= 9 else LIFE_PRECISION[p], "circa": circa}
    return None
```

In `class Wikidata`, after `def person(self, qid)`:

```python
    def details_entities(self, qids):
        """For the reader's popups: descriptions, claims and Wikipedia sitelinks in
        the interface languages, by QID. Labels are not asked: the frontend's
        persons snapshot already has them."""
        out = {}
        for i in range(0, len(qids), 50):
            data = self._api(action="wbgetentities", ids="|".join(qids[i:i + 50]),
                             props="descriptions|claims|sitelinks", languages="|".join(DETAIL_LANGS),
                             sitefilter="|".join(f"{lang}wiki" for lang in DETAIL_LANGS))
            for qid, raw in data.get("entities", {}).items():
                if "missing" not in raw:
                    out[qid] = raw
        return out

    def commons_files(self, files):
        """Commons' extmetadata (author, license) for each file name as P18 gives
        it, without "File:"; a missing file is left out."""
        out = {}
        for i in range(0, len(files), 50):
            titles = "|".join("File:" + f for f in files[i:i + 50])
            data = self._get(COMMONS_API + "?" + urllib.parse.urlencode(
                {"action": "query", "titles": titles, "prop": "imageinfo", "iiprop": "extmetadata",
                 "format": "json", "maxlag": "5"}))
            query = data.get("query", {})
            asked = {n["to"]: n["from"] for n in query.get("normalized", [])}
            for page in query.get("pages", {}).values():
                info = page.get("imageinfo")
                if info:
                    out[asked.get(page["title"], page["title"]).removeprefix("File:")] = info[0].get("extmetadata", {})
        return out
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_person_details -v` and then `python3 -m unittest discover -s tests`
Expected: 9 tests in the module OK, and the whole suite OK. The existing `test_gazetteer` and `test_person_items` must be unchanged by this.

- [ ] **Step 5: Commit**

```bash
git add scripts/wikidata.py tests/test_person_details.py
git commit -m "wikidata: life dates with precision and circa, descriptions and sitelinks, Commons credits"
```

---

### Task 9: `person_details.py`

**Files:**
- Create: `scripts/person_details.py`
- Test: `tests/test_person_details.py` (append)

**Interfaces:**
- Consumes:
  - from `wikidata.py` (Task 8): `DETAIL_LANGS`, `life_date`, `Wikidata.details_entities`, `Wikidata.commons_files`, `_value`;
  - `data/mentions.json` (Task 5 shape).
- Produces:
  - `plain(html: str | None) -> str | None`
  - `portrait(raw) -> str | None`
  - `image_credit(file, meta) -> dict | None`
  - `summarize_details(raw, images) -> {"description", "born", "died", "image", "wikipedia"}`
  - `person_qids(mentions_doc) -> list[str]`
  - `build(client, qids) -> dict`
  - `render_json(details) -> str`
  - `main(argv)`

  The file it writes, `data/person_details.json`, is `{"$comment": str, "<QID>": details, ...}`, with QIDs sorted by number.

- [ ] **Step 1: Write the failing tests (append to `tests/test_person_details.py`, before `if __name__`; add `import person_details as pd  # noqa: E402` under the `wikidata` import)**

```python
RAW = {
    "id": "Q19546",
    "descriptions": {"en": {"value": "Greek bishop"}, "la": {"value": "episcopus"}},
    "claims": {"P569": [claim("+0329-00-00T00:00:00Z", circa=True)],
               "P570": [claim("+0379-01-01T00:00:00Z", 11)],
               "P18": [{"rank": "normal", "mainsnak": {"datavalue": {"value": "Basil.jpg"}}}]},
    "sitelinks": {"enwiki": {"title": "Basil of Caesarea"}, "lawiki": {"title": "Basilius Magnus"}},
}
CREDIT = {"Artist": {"value": "<a href='https://x'>Unknown</a> painter"},
          "LicenseShortName": {"value": "Public domain"}}


class SummarizeTest(unittest.TestCase):
    def test_details_in_the_interface_languages_only(self):
        self.assertEqual(pd.summarize_details(RAW, {"Basil.jpg": CREDIT}), {
            "description": {"en": "Greek bishop"},
            "born": {"year": 329, "precision": "year", "circa": True},
            "died": {"year": 379, "precision": "year", "circa": False},
            "image": {"file": "Basil.jpg", "author": "Unknown painter", "license": "Public domain",
                      "license_url": None},
            "wikipedia": {"en": "Basil of Caesarea"},
        })

    def test_no_license_no_image(self):
        self.assertIsNone(pd.summarize_details(RAW, {"Basil.jpg": {"Artist": {"value": "X"}}})["image"])
        self.assertIsNone(pd.summarize_details(RAW, {})["image"])

    def test_a_bare_item(self):
        self.assertEqual(pd.summarize_details({"id": "Q1"}, {}),
                         {"description": {}, "born": None, "died": None, "image": None, "wikipedia": {}})


class BuildTest(unittest.TestCase):
    def test_person_qids(self):
        doc = {"editions": {"ed": {"mr:x": [{"kind": "person", "qid": "Q19546"}, {"kind": "person", "qid": None},
                                            {"kind": "place", "qid": "Q220"}, {"kind": "person", "qid": "Q9"}]}}}
        self.assertEqual(pd.person_qids(doc), ["Q9", "Q19546"])

    def test_build_skips_missing_items_and_asks_commons_once(self):
        class Client:
            files = None

            def details_entities(self, qids):
                return {"Q19546": RAW}

            def commons_files(self, files):
                self.files = files
                return {"Basil.jpg": CREDIT}

        client = Client()
        out = pd.build(client, ["Q19546", "Q404"])
        self.assertEqual(list(out), ["Q19546"])
        self.assertEqual(client.files, ["Basil.jpg"])
        self.assertEqual(out["Q19546"]["image"]["license"], "Public domain")

    def test_render_json(self):
        doc = json.loads(pd.render_json({"Q20": {}, "Q3": {}}))
        self.assertEqual(list(doc), ["$comment", "Q3", "Q20"])
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m unittest tests.test_person_details -v`
Expected: ERROR, `ModuleNotFoundError: No module named 'person_details'`.

- [ ] **Step 3: Write the implementation**

`scripts/person_details.py`:

```python
#!/usr/bin/env python3
"""Gather what the reader's person popups show for each person a mention links to.

For each QID in data/mentions.json: the Wikidata description and the Wikipedia
article title in each interface language, the dates of birth and death with
their precision and whether they are circa, and the portrait (P18) with the
author and license Commons gives it. A portrait whose license Commons does not
state is left out, never shown without its credit. Labels are not gathered:
martyrology-frontend's persons snapshot has them. Needs network access
(cached in .cache/wikidata/).

  data/person_details.json   {"$comment": ..., QID: details}

Usage:
  python3 scripts/person_details.py [repo_root]

Standard library only.
"""

import html
import json
import re
import sys
from pathlib import Path

from wikidata import DETAIL_LANGS, Wikidata, _value, life_date

TAG = re.compile(r"<[^>]+>")
COMMENT = ("What martyrology-frontend's person popups show, by Wikidata item, for each person "
           "data/mentions.json links to: description and Wikipedia title per interface language, "
           "birth and death (year, negative before Christ; precision year, decade or century; circa), and the portrait with its Commons author and "
           "license (null when Commons states no license). Generated by scripts/person_details.py.")


def plain(s):
    """Commons' extmetadata HTML as plain text; None when empty."""
    return " ".join(html.unescape(TAG.sub("", s or "")).split()) or None


def portrait(raw):
    """The item's portrait file (P18), or None."""
    return next((_value(c) for c in raw.get("claims", {}).get("P18", [])
                 if c.get("rank") != "deprecated" and isinstance(_value(c), str)), None)


def image_credit(file, meta):
    """The portrait with its author and license; None when Commons states no license."""
    license_name = plain(meta.get("LicenseShortName", {}).get("value"))
    if not license_name:
        return None
    return {"file": file, "author": plain(meta.get("Artist", {}).get("value")), "license": license_name,
            "license_url": meta.get("LicenseUrl", {}).get("value") or None}


def summarize_details(raw, images):
    claims, descs, links = raw.get("claims", {}), raw.get("descriptions", {}), raw.get("sitelinks", {})
    file = portrait(raw)
    return {
        "description": {lang: descs[lang]["value"] for lang in DETAIL_LANGS if lang in descs},
        "born": life_date(claims, "P569"),
        "died": life_date(claims, "P570"),
        "image": image_credit(file, images[file]) if file in images else None,
        "wikipedia": {lang: links[f"{lang}wiki"]["title"] for lang in DETAIL_LANGS if f"{lang}wiki" in links},
    }


def _qid_number(qid):
    return int(qid[1:])


def person_qids(mentions_doc):
    """The QIDs that person mentions link to, by number."""
    return sorted({m["qid"] for by_id in mentions_doc["editions"].values() for ms in by_id.values() for m in ms
                   if m["kind"] == "person" and m.get("qid")}, key=_qid_number)


def build(client, qids):
    raws = client.details_entities(qids)
    files = sorted({f for f in (portrait(raw) for raw in raws.values()) if f})
    images = client.commons_files(files) if files else {}
    return {q: summarize_details(raws[q], images) for q in qids if q in raws}


def render_json(details):
    doc = {"$comment": COMMENT, **{q: details[q] for q in sorted(details, key=_qid_number)}}
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


def main(argv):
    repo_root = Path(argv[0]) if argv else Path(__file__).resolve().parent.parent
    data = repo_root / "data"
    qids = person_qids(json.loads((data / "mentions.json").read_text(encoding="utf-8")))
    details = build(Wikidata(repo_root / ".cache" / "wikidata"), qids)
    (data / "person_details.json").write_text(render_json(details), encoding="utf-8")
    print(f"wrote data/person_details.json: {len(details)} of {len(qids)} persons; "
          f"{sum(1 for d in details.values() if d['image'])} with a portrait")


if __name__ == "__main__":
    main(sys.argv[1:])
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.test_person_details -v`
Expected: 15 tests, OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/person_details.py tests/test_person_details.py
git commit -m "person details: descriptions, dates, credited portraits and Wikipedia titles for the popups"
```

---

### Task 10: Generate the data, document it, open the PR

**Files:**
- Generated: `data/mentions.json`, `docs/mentions-report.md`, `data/person_details.json`
- Create: `docs/mentions-changeset.md`
- Modify: `AGENTS.md`, `README.md`

**Interfaces:**
- Consumes: Tasks 1–9; the private `../martyrology-texts` checkout; network access for Wikidata and Commons.
- Produces, for plans 2 and 3:
  - `data/mentions.json` and `data/person_details.json` committed on crmedr `main`;
  - the merge commit's SHA, which plan 2 pins in `vendor/crmedr`.

- [ ] **Step 1: Run the extraction against the real texts**

The review change-set goes to the private change-set directory, outside every repository. Locally, use a directory such as `~/martyrology-changesets`; on the server, it is martyrology-frontend's `CHANGESETS_DIR`.

```bash
mkdir -p ~/martyrology-changesets
python3 scripts/extract_mentions.py ../martyrology-texts --review ~/martyrology-changesets/mentions-review.json
```

Expected: `wrote data/mentions.json: N mentions; M to review in …`. The script exits non-zero with `invalid mentions:` if any span fails validation; fix the matcher (with a test) rather than the data.

- [ ] **Step 2: Check the success criteria in `docs/mentions-report.md`**

Run: `sed -n 1,40p docs/mentions-report.md`
Expected, for `martyrologium_romanum_2004`:
- "Places in the text": a share of at least **98.0%**;
- "Persons in the text": a share of at least **95.0%**.

For the Italian edition, "Places in the text" must be at least 98.0%.

If a share is short:
1. Open the review change-set, and look at the `add_mention` operations with `form: null` or partial spans.
2. Find the pattern behind them.
3. Add a test for it to `tests/test_mentions_text.py`, then extend the matcher.
4. Rerun Step 1.

Never hand-edit `data/mentions.json`.

- [ ] **Step 3: Gather the person details**

Run: `python3 scripts/person_details.py`
Expected: `wrote data/person_details.json: K of K persons; P with a portrait`. K is about 940 today, the distinct person QIDs in `person_items.json`. A second run reads `.cache/wikidata/` and finishes without network.

- [ ] **Step 4: Check that nothing quoting the texts is staged**

Run: `git status --short && git check-ignore -v mentions-review.json && grep -c '"form"' data/mentions.json data/mentions_curated.json`
Expected:
- only the files of this task, and those of Tasks 1–9, appear;
- `mentions-review.json` is reported as ignored by `.gitignore`;
- `grep -c '"form"'` prints 0 for both data files;
- no `*review*.json` with context is staged.

- [ ] **Step 5: Write `docs/mentions-changeset.md`**

```markdown
# Mention operations in `crmedr-changeset/v1`

`scripts/extract_mentions.py --review PATH` writes the mentions it could not settle as a change-set, which
martyrology-frontend's Review page shows. It quotes the 2004 texts (`context`), so it is written only outside this
repository, in the frontend's private `CHANGESETS_DIR`, and never committed. `.gitignore` excludes
`mentions-review.json`. The operations concern only where a mention's words are. A mention's Wikidata item is
decided by `resolve_person` (person_items.json) and `resolve_place` (gazetteer.json).

Common fields, all three operations:

| Field | Meaning |
| --- | --- |
| `id` | `<edition>\|<eulogy>\|<where>\|<start>`; `<where>` is `text` or `footnote:<n>`. An `add_mention` with no span ends with the person's name instead of `<start>`. |
| `edition`, `eulogy` | The edition and canonical ID |
| `where` | `"text"` or `{"footnote": n}` |
| `kind` | `"person"` or `"place"` |
| `start`, `end`, `form` | The span in UTF-16 code units and the words as printed; `null` for an `add_mention` with no span |
| `context`, `context_start` | The words around the span, and the UTF-16 offset in the text (or footnote) at which they begin. The span is at `start - context_start` in `context`. With no span, `context` is the whole text and `context_start` is 0. |
| `reasoning` | Why it is asked |
| `decision` | `null`, then `"accept"`, `"reject"` or `"edit"` |

- `add_mention` (also `name`, for a person; and `edited`): add a mention.
  - An `edited` of `{start, end, form}` replaces the span.
  - An `add_mention` with no span can only be applied as an edit.
- `remove_mention`: remove the mention at `start`–`end`.
- `set_span` (`from: {start, end}`, `to: {start, end, form}`, `edited`): move a mention's span.
  - The extraction never proposes it; a curator authors it.

`python3 scripts/extract_mentions.py apply <exported.json> /path/to/martyrology-texts --review PATH` writes
each eulogy an accepted operation touches into `data/mentions_curated.json`, as its complete list of
mentions. Each touched span gets a `check` computed from the texts, in place of the operation's `form`, which is
never stored. `apply` checks every curated span against the texts first, writes nothing if one fails, and then
extracts again.
```

- [ ] **Step 6: Update `AGENTS.md`**

At the end of the paragraph that begins `**Names are facts too.**` (after "...are read to check them and never stored."), add one sentence:

```markdown
`data/mentions.json` records where those names and the place designations are printed, as offsets with a hash of the printed words (`check`), never the words themselves.
```

Under "## Architecture: the generation pipeline", after item 7, add:

```markdown
8. **`scripts/extract_mentions.py`** reads `data/places.json`, `data/persons.json`, `data/gazetteer.json`, `data/person_items.json`, `data/mentions_curated.json` and the private `martyrology-texts` repo (Latin and Italian 2004 texts, Latin footnotes), and writes `data/mentions.json` (with the texts commit it was computed from) and `docs/mentions-report.md`, plus the review change-set outside the repo (`docs/mentions-changeset.md`). QIDs are copied from the person and place decisions. Rerun it after `extract_persons.py`, `extract_places.py`, `build_person_items.py apply` or `build_gazetteer.py apply`.
   - Run: `python3 scripts/extract_mentions.py /path/to/martyrology-texts --review /outside/mentions-review.json`; after review, `python3 scripts/extract_mentions.py apply <exported.json> /path/to/martyrology-texts --review /outside/mentions-review.json` (stdlib only)
9. **`scripts/person_details.py`** writes `data/person_details.json` (description, Wikipedia title, life dates and credited portrait per person QID in `data/mentions.json`, for martyrology-frontend's popups). Network access, cached in `.cache/wikidata/`.
   - Run: `python3 scripts/person_details.py`
```

- [ ] **Step 7: Update `README.md`**

In "## Repository contents", after the `data/person_items.json` bullet, add:

```markdown
- [`data/mentions.json`](data/mentions.json) — where each eulogy of the 2004 Latin and Italian editions names its persons and places: offsets into its text or a footnote, a hash of the printed words (never the words), and the Wikidata item decided for it; for martyrology-frontend's marked-up reader. Curators' corrections in [`data/mentions_curated.json`](data/mentions_curated.json); counts in [`docs/mentions-report.md`](docs/mentions-report.md); the review operations in [`docs/mentions-changeset.md`](docs/mentions-changeset.md)
- [`data/person_details.json`](data/person_details.json) — for each person those mentions link to, the Wikidata description and Wikipedia title per interface language, the dates of birth and death, and the portrait with its Commons author and license
```

"## Copyright and the absence of texts" is unchanged: the mentions data quotes no text.

- [ ] **Step 8: Run the whole suite and commit**

Run: `python3 -m unittest discover -s tests`
Expected: OK, with all earlier tests and the 79 new ones passing.

```bash
git add data/mentions.json data/person_details.json docs/mentions-report.md docs/mentions-changeset.md AGENTS.md README.md
git commit -m "mentions: the 2004 Latin and Italian mentions, person details, and their documentation"
```

- [ ] **Step 9: Push and open the PR**

```bash
git push -u origin feat/mentions
gh pr create --title "Mentions: where each 2004 eulogy names its persons and places, and person details" --body "$(cat <<'EOF'
## Summary
- `scripts/extract_mentions.py` writes `data/mentions.json`: UTF-16 offset spans of each person (Latin) and place (Latin, Italian) in the 2004 texts and footnotes, each with a `check` (the first 8 hex digits of the SHA-256 of the printed words, never the words) and the Wikidata item copied from `person_items.json` / `gazetteer.json`, and the `martyrology-texts` commit the offsets were computed from.
- Curators' corrections: `data/mentions_curated.json`, the `add_mention` / `set_span` / `remove_mention` change-set operations (`docs/mentions-changeset.md`), and `extract_mentions.py apply`.
- The review change-set quotes the texts, so it is written only outside the repo (`--review`, refused inside it, `mentions-review.json` git-ignored).
- `scripts/person_details.py` writes `data/person_details.json`: per person, the description and Wikipedia title per interface language, life dates with precision and circa, and the portrait with its Commons credit.
- crmedr's text policy is unchanged: AGENTS.md says the mentions are offsets with a hash, never the words.

## Coverage
(paste the tables from docs/mentions-report.md)

## Test plan
- [x] `python3 -m unittest discover -s tests`
- [x] Extraction against martyrology-texts at the commit in `data/mentions.json`: places ≥ 98%, persons in the text ≥ 95%
- [x] No review change-set staged (`git check-ignore -v mentions-review.json`)

Spec: martyrology-frontend `docs/superpowers/specs/2026-10-09-eulogy-markup-design.md` (plan 1 of 4).
EOF
)"
```

End the PR body with the session's attribution lines.

---

## Self-Review

- **Spec coverage:**

  | Spec requirement | Task |
  |---|---|
  | `mentions.json` shape, with `check` in place of `form` (owner's decision) | 5, 6 (policy scan), 7 |
  | Places verbatim and folded | 2 |
  | *Ibídem* / *Sempre a* / *Ancora a* / *Ivi* | 2, 4 |
  | Persons verbatim, stem, parenthesis and cognomento | 3 |
  | Not part of a longer marked name (longest first, taken spans) | 3, 4 |
  | Footnote mentions | 4 |
  | Overlap: the place wins, the person reported | 4 |
  | UTF-16 | 1, 5 |
  | QIDs copied from the decisions | 4, 5 |
  | `mentions_curated.json` override | 5 |
  | Report | 5 |
  | Review change-set with context, outside the repo | 6 |
  | `apply` | 7 |
| Footnote numbering from 1 in printed order, offsets from the footnote (amendment 11) | 4 |
  | `person_details.json`: descriptions and sitelinks in six languages, dates, P18 with credit, left out without a license | 8, 9 |
  | Schema docs | 10 |
  | Every spec test for crmedr | 1–9 |
  | Success criteria | 10, Step 2 |

- **Placeholder scan:** the one temporary stub, `apply` raising `NotImplementedError`, is introduced in Task 6 and replaced in Task 7 by name. There are no TBDs.
- **Type consistency:**
  - `where_key` gives `"footnote:<n>"` everywhere: internal keys, ids and validation.
  - Review items carry `kind` in Task 4, and `review_ops` reads `r["kind"]` in Task 6.
  - `build_edition` takes `curated` in UTF-16 and converts with `curated_mention`.
  - `apply_decisions` works in UTF-16 and `apply` converts before `validate`.
  - `source(edition, eulogy, where)` has the same signature in `validate`, `render_json` and `review_ops`.
- **Review Focus:** each of the five lines has its test in the task named.
