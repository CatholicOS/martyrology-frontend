# Eulogy markup, part 2 of 4: martyrology-api serves the mentions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every eulogy the API serves (day, month, single-eulogy and `/elogium` placement responses) carries
`mentions`: the persons and places crmedr found in its text and footnotes, each with the printed words it covers.
Each mention is checked against the text it points into, and none is served where the text is withheld.

**Architecture:**
- **Loading:** a new module, `src/martyrology_api/mentions.py`, loads crmedr's `data/mentions.json`. Each mention
  there carries a `check`, a short hash of its printed words, instead of the words themselves. The file also carries
  the `martyrology-texts` commit its offsets were taken from.
- **Checking at start-up:** each mention is checked against the attached texts. The words between its `start` and
  `end` (UTF-16 code units) must hash to its `check`. The `Store` keeps the mentions that land. The start-up log
  reports the count dropped and the texts commit, and warns when that commit differs from the one this deployment
  serves.
- **Serving:** the read router builds each served mention in `elogium_out`, re-checking it against the text
  actually served and filling `form` from that text. So a curator's draft text never carries spans that no longer
  fit, and the API never serves words it didn't read itself.
- **Withholding:** `licensing.redact` empties the mentions along with the text.
- **OpenAPI:** the read routes declare their 200 response models, so the OpenAPI document finally describes
  `ElogiumOut` and its new `MentionOut`.

**Tech Stack:** Python 3.12, FastAPI 0.141, Pydantic 2, `hashlib`, pytest, ruff, pyright (all in `.venv`).

**Spec:** `martyrology-frontend/docs/superpowers/specs/2026-10-09-eulogy-markup-design.md`, sections "crmedr →
`data/mentions.json`" and "martyrology-api", as amended by the contract settled across the four plans (below). This
plan is part 2 of 4:

1. crmedr (writes `data/mentions.json`)
2. this plan
3. the frontend reader
4. the frontend `/review` cards

**Repo:** `/home/johnrdorazio/development/CatholicOS_org/martyrology-api`. Work on a branch `feat/mentions` off
`main`. Tasks 1–4 need nothing from crmedr: they run on the test fixtures. Task 5 needs part 1 merged.

## Global Constraints

- **The file crmedr writes (`data/mentions.json`)** looks like this:
  ```jsonc
  { "$comment": "…",
    "texts": { "commit": "<martyrology-texts sha>" | null },
    "editions": { "<edition>": { "<canonical id>": [
      { "kind": "person" | "place", "where": "text" | { "footnote": n }, "start": 0, "end": 7,
        "check": "4729ea69", "qid": "Q…" | null, "name": "Basilius" /* persons only */ } ] } } }
  ```
  - There is **no `form` in the file**: crmedr doesn't store the printed words.
  - `name` appears only on persons.
  - Place QIDs are crmedr's decisions; the API passes them through.
- **`check`:** the first 8 lowercase hex digits of SHA-256 over the UTF-8 bytes of the printed span. The span is
  `text[start:end]` counted in **UTF-16 code units**, in the original characters (not folded, not normalized).
  Known vector: `"Basilíi"` (with a precomposed U+00ED) → `4729ea69`.
- **`{"footnote": n}`** counts from 1, in the order the eulogy's `footnotes` list them. crmedr numbers them with
  `enumerate(footnotes, start=1)` over the same `footnotes.json`.
- **A served mention** has `kind`, `where`, `start`, `end`, `form`, `qid` (string or null) and `name` (always
  present; null for a place).
  - `form` is the API's own slice of the text it serves, never anything read from crmedr.
  - `check` is not served.
- **A mention is served only if its slice hashes to `check`.** A mismatch at start-up is dropped and logged once
  (edition, eulogy, where, offsets, `check`). The start-up log reports the count of dropped mentions and the texts
  commit the offsets came from. When this deployment's texts commit is known (from the bundle manifest) and differs
  from it, a warning names both.
- **`mentions`** is `[]` when a eulogy has none, and `[]` whenever its text is withheld (the same rule as
  `footnotes`, `marginalia`, `errata`).
- **The edition list is unchanged.** Nothing is added to `EditionOut`.
- **Decided here (the spec is silent):** a missing `data/mentions.json`, as with a crmedr pin from before part 1,
  logs a warning and serves `mentions: []` everywhere. A malformed one raises at start-up, naming the file, exactly
  as a malformed `footnotes.json` does.
- **Decided here:** the OpenAPI schema is named `MentionOut`, following the repo's `FootnoteOut` / `ErratumOut`
  convention (the spec says "`Mention`").
- **Style:**
  - ruff (`E F W I UP B`, line length 100) and `ruff format`, with pyright in basic mode;
  - docstrings say what a thing is, in the repo's voice;
  - commit subjects are sentence case and imperative, without a conventional-commit prefix;
  - every commit ends with:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
    ```
- **Coverage** must stay ≥ 90% (`fail_under = 90`).

## Review Focus

The inputs and conditions most likely to bite, and the task whose test pins each:

1. **A curator's draft text** (the `X-Curation-Branch` read) whose words have moved: the start-up check passed on
   the published text, so the draft must carry no spans that no longer fit, and no `form` taken from the published
   text. Task 3, `test_a_draft_whose_text_changed_carries_no_mentions`.
2. **The access rule switched to `authenticated` or `grant`:** an anonymous caller must get `mentions: []` on day,
   month, single-eulogy and placement responses, because `form` quotes the copyrighted text. Task 3,
   `test_withheld_texts_carry_no_mentions`.
3. **Accented spans:** the hash covers the original characters. A precomposed "í" and an "i" followed by a
   combining accent are different spans, and folding or normalizing before hashing would make every check miss.
   Task 1, `test_span_check_is_pinned_by_a_known_vector` and `…_does_not_normalize`.
4. **A character outside the Basic Multilingual Plane before the span,** or a span that cuts a surrogate pair:
   offsets count UTF-16 units, and a cut pair is a miss, not a crash. Task 1, `test_utf16_slice_*`.
5. **A footnote mention naming a footnote the eulogy doesn't have,** or a eulogy the edition doesn't print: dropped
   with a log line, never an IndexError at start-up. Task 2,
   `test_the_store_keeps_the_mentions_that_land_and_logs_the_rest`.

Also pinned: a missing file (Task 3, `test_a_crmedr_without_mentions_serves_none`), and a texts-commit mismatch
(Task 2 unit test and Task 3 wiring test).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/martyrology_api/models.py` (modify) | `MentionFootnote`, `MentionBase` (the fields shared by file and response), `MentionOut`; a `mentions` field on `ElogiumOut` and `EditionPlacementOut`. |
| `src/martyrology_api/mentions.py` (create) | `MentionIn` (the file's mention), `MentionsFile`, `load_mentions`, `span_check`, `utf16_slice`, `lands`, `served`, `check_mentions`, `compare_texts_pins`. |
| `src/martyrology_api/store.py` (modify) | `Store.attach_mentions()`, `Store.mentions()`, `Store._texts()`. |
| `src/martyrology_api/app.py` (modify) | Load and attach the mentions at start-up; compare the texts commits. |
| `src/martyrology_api/routers/read.py` (modify) | Build served mentions in `elogium_out` / `_day_content` / `get_elogium`; declare the 200 response models. |
| `src/martyrology_api/licensing.py` (modify) | `redact()` empties `mentions`. |
| `tests/fixtures/crmedr/data/mentions.json` (create) | Mentions in the fixture texts, including three that must be dropped and one for an edition without texts. |
| `tests/test_mentions.py` (create) | Unit tests: models, the check, loading, slicing, `lands`/`served`, the start-up check through the `Store`, the pin comparison. |
| `tests/test_mentions_api.py` (create) | The served field on every read route, redaction, a missing file, the pin warning at start-up. |
| `tests/test_curation_api.py` (modify) | The draft-read case. |
| `tests/test_openapi.py` (modify) | `MentionOut` and the read routes' response schemas. |
| `tests/test_smoke_realdata.py` (modify) | crmedr's real `mentions.json` loads and validates. |
| `vendor/crmedr`, `Dockerfile` (modify, Task 5) | The crmedr pin with `data/mentions.json`. |

---

### Task 1: The mention models, the check, loading the file

**Files:**
- Modify: `src/martyrology_api/models.py`: imports, after `ErratumOut` (around line 75), and the `ElogiumOut` /
  `EditionPlacementOut` classes
- Create: `src/martyrology_api/mentions.py`
- Test: `tests/test_mentions.py`

**Interfaces:**
- Produces:
  - `models.MentionFootnote(footnote: int ≥ 1)`, with extra keys forbidden.
  - `models.MentionBase(kind: Literal["person","place"], where: Literal["text"] | MentionFootnote, start: int ≥ 0,
    end: int > start, qid: str | None = None, name: str | None = None)`.
  - `models.MentionOut(MentionBase)`, adding `form: str`.
  - `ElogiumOut.mentions: list[MentionOut]` and `EditionPlacementOut.mentions: list[MentionOut]`, both defaulting
    to `[]`.
  - `mentions.MentionIn(MentionBase)`, adding `check: str` (pattern `^[0-9a-f]{8}$`).
  - `mentions.Mentions = dict[str, dict[str, list[MentionIn]]]` (edition → canonical id → mentions).
  - `mentions.TextsPin(commit: str | None = None)`.
  - `mentions.MentionsFile(editions: Mentions, texts: TextsPin = TextsPin())`, with the property
    `texts_commit -> str | None`.
  - `mentions.load_mentions(path: Path) -> MentionsFile`.
  - `mentions.span_check(words: str) -> str` (8 hex digits).
  - `mentions.utf16_slice(s: str, start: int, end: int) -> str | None`.
  - `mentions.lands(m: MentionIn, text: str | None, footnotes: list[FootnoteOut]) -> str | None`: the printed words
    when they hash to `m.check`, else None.
  - `mentions.served(ms: list[MentionIn], text: str | None, footnotes: list[FootnoteOut]) -> list[MentionOut]`.

- [ ] **Step 1: Create the branch**

```bash
cd /home/johnrdorazio/development/CatholicOS_org/martyrology-api
git checkout main && git pull && git checkout -b feat/mentions
```

- [ ] **Step 2: Write the failing tests**

Create `tests/test_mentions.py`. The helper `_check` restates the definition on its own, so the tests pin the
definition rather than echoing the implementation:

```python
import hashlib
import json
import logging

import pytest
from pydantic import ValidationError

from martyrology_api.mentions import (
    MentionIn,
    lands,
    load_mentions,
    served,
    span_check,
    utf16_slice,
)
from martyrology_api.models import FootnoteOut, MentionFootnote, MentionOut


def _check(words: str) -> str:
    """The definition: the first 8 hex digits of SHA-256 over the UTF-8 bytes of the words."""
    return hashlib.sha256(words.encode("utf-8")).hexdigest()[:8]


def _m(words: str = "x", **kw) -> MentionIn:
    base = {"kind": "person", "where": "text", "start": 0, "end": 1, "check": _check(words)}
    return MentionIn.model_validate(base | kw)


def test_span_check_is_pinned_by_a_known_vector():
    assert span_check("Basilíi") == "4729ea69"  # "í" precomposed, U+00ED
    assert span_check("Concordii") == _check("Concordii")


def test_span_check_does_not_normalize():
    decomposed = "Basilíi"  # "i" followed by a combining acute accent
    assert span_check(decomposed) == "16d99f80" != span_check("Basilíi")


def test_utf16_slice_counts_code_units_not_code_points():
    s = "𝔄 Romæ"  # 𝔄 lies outside the BMP: one Python character, two UTF-16 code units
    assert utf16_slice(s, 3, 7) == "Romæ"
    assert s[3:7] != "Romæ"  # Python's own indices would land one character late


def test_utf16_slice_refuses_a_span_past_the_end_or_through_a_surrogate_pair():
    assert utf16_slice("Romæ", 0, 5) is None
    assert utf16_slice("𝔄", 0, 1) is None


def test_a_text_mention_lands_on_its_words_and_nowhere_else():
    romae = _m("Romæ", start=7, end=11)
    assert lands(romae, "Natale Romæ", []) == "Romæ"
    assert lands(romae, "Natale Romæ, et", []) == "Romæ"  # text after the span is no matter
    assert lands(romae, "Natale Romam", []) is None  # the words changed
    assert lands(_m("Romæ", start=0, end=4), "Natale Romæ", []) is None  # the span moved
    assert lands(romae, None, []) is None  # withheld or unaligned text


def test_a_footnote_mention_lands_in_its_footnote_counted_from_one():
    notes = [FootnoteOut(mark="1", after=None, text="Quorum nomina: sancti Narcissus.")]
    narcissus = _m("Narcissus", where={"footnote": 1}, start=22, end=31)
    assert lands(narcissus, "Textus.", notes) == "Narcissus"
    assert lands(narcissus.model_copy(update={"where": "text"}), "Textus.", notes) is None
    assert lands(_m("Narcissus", where={"footnote": 2}, start=22, end=31), "Textus.", notes) is None


def test_served_fills_form_from_the_text_and_leaves_the_check_behind():
    place = _m("Romæ", kind="place", start=7, end=11, qid="Q220")
    stale = _m("Romæ", start=0, end=4)
    out = served([place, stale], "Natale Romæ", [])
    assert out == [
        MentionOut(kind="place", where="text", start=7, end=11, form="Romæ", qid="Q220", name=None)
    ]
    assert "check" not in out[0].model_dump()
    assert out[0].model_dump()["name"] is None  # always present, null for a place


@pytest.mark.parametrize(
    "bad",
    [
        {"end": 0},  # end must follow start
        {"start": -1},
        {"check": "4729EA69"},  # lowercase hex only
        {"check": "4729ea6"},  # eight digits
        {"kind": "event"},
        {"where": {"footnote": 0}},  # footnotes count from 1
        {"where": {"footnote": 1, "mark": "a"}},  # nothing else in `where`
        {"where": "margin"},
    ],
)
def test_a_malformed_mention_is_refused(bad):
    with pytest.raises(ValidationError):
        _m(**bad)


def test_a_place_needs_no_name_and_a_qid_may_be_undecided():
    m = _m(kind="place")
    assert m.name is None and m.qid is None
    assert isinstance(_m(where={"footnote": 3}).where, MentionFootnote)


def test_load_mentions_reads_the_editions_and_the_texts_commit(tmp_path):
    path = tmp_path / "mentions.json"
    path.write_text(
        json.dumps(
            {
                "$comment": "…",
                "texts": {"commit": "4e89ec8"},
                "editions": {
                    "martyrologium_romanum_2004": {
                        "mr:0101-basilius": [
                            {"kind": "person", "where": "text", "start": 46, "end": 53,
                             "check": "4729ea69", "name": "Basilius", "qid": None}
                        ]
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    got = load_mentions(path)
    assert got.texts_commit == "4e89ec8"
    assert got.editions["martyrologium_romanum_2004"]["mr:0101-basilius"][0].check == "4729ea69"


def test_a_file_without_a_texts_commit_reads_as_unknown(tmp_path):
    path = tmp_path / "mentions.json"
    path.write_text('{"editions": {}}', encoding="utf-8")
    assert load_mentions(path).texts_commit is None


def test_a_missing_mentions_file_is_no_mentions_with_a_warning(tmp_path, caplog):
    caplog.set_level(logging.WARNING, logger="martyrology_api.mentions")
    got = load_mentions(tmp_path / "mentions.json")
    assert got.editions == {} and got.texts_commit is None
    assert "mentions.json is missing" in caplog.text


@pytest.mark.parametrize(
    "body",
    [
        "not json",
        '{"editions": []}',
        '{"editions": {"e": {"i": [{}]}}}',
        # crmedr stores no printed words: a mention without its check is malformed
        '{"editions": {"e": {"i": [{"kind": "place", "where": "text", "start": 0, "end": 1}]}}}',
    ],
)
def test_a_malformed_mentions_file_fails_at_once_naming_it(tmp_path, body):
    path = tmp_path / "mentions.json"
    path.write_text(body, encoding="utf-8")
    with pytest.raises(ValueError, match=r"mentions\.json"):
        load_mentions(path)
```

- [ ] **Step 3: Run them to see them fail**

Run: `.venv/bin/pytest -q tests/test_mentions.py`
Expected: collection error, `ModuleNotFoundError: No module named 'martyrology_api.mentions'`.

- [ ] **Step 4: Add the models**

In `src/martyrology_api/models.py`, change the pydantic import to:

```python
from pydantic import BaseModel, ConfigDict, Field, model_validator
```

and add after `ErratumOut`:

```python
class MentionFootnote(BaseModel):
    """Where a mention printed in a footnote stands: the eulogy's nth footnote, counted from 1 in
    the order its `footnotes` list them."""

    model_config = ConfigDict(extra="forbid")

    footnote: int = Field(ge=1)


class MentionBase(BaseModel):
    """A person or place a eulogy names (crmedr `data/mentions.json`): the span from `start` to
    `end` of its text, or of the footnote `where` names, in UTF-16 code units, the unit JavaScript
    strings use. `qid` is the Wikidata item crmedr decided (null while undecided); `name` is a
    person's nominative, null for a place."""

    kind: Literal["person", "place"]
    where: Literal["text"] | MentionFootnote
    start: int = Field(ge=0)
    end: int
    qid: str | None = None
    name: str | None = None

    @model_validator(mode="after")
    def _a_span(self) -> "MentionBase":
        if self.end <= self.start:
            raise ValueError("end must come after start")
        return self


class MentionOut(MentionBase):
    """A mention as served: `form` is the words of the span as printed, read from the text served
    with it."""

    form: str
```

Add the field to `ElogiumOut` (after `errata`) and to `EditionPlacementOut` (after `errata`):

```python
    mentions: list[MentionOut] = Field(default_factory=list)
```

- [ ] **Step 5: Write `mentions.py`**

Create `src/martyrology_api/mentions.py`:

```python
"""The persons and places the eulogies name (crmedr `data/mentions.json`), and the check that each
one still lands on the words it names. crmedr stores no printed words: each mention carries a
`check` of them, and the API reads the words from its own texts."""

import hashlib
import logging
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError

from .models import FootnoteOut, MentionBase, MentionFootnote, MentionOut

log = logging.getLogger(__name__)


class MentionIn(MentionBase):
    """A mention as crmedr writes it: `check` is `span_check` of the words it covers."""

    check: str = Field(pattern=r"^[0-9a-f]{8}$")


# Edition → canonical id → the eulogy's mentions, text first, then its footnotes in order.
Mentions = dict[str, dict[str, list[MentionIn]]]


class TextsPin(BaseModel):
    """The martyrology-texts commit crmedr took the offsets from; null when it did not record it."""

    commit: str | None = None


class MentionsFile(BaseModel):
    """crmedr's `data/mentions.json`."""

    editions: Mentions
    texts: TextsPin = Field(default_factory=TextsPin)

    @property
    def texts_commit(self) -> str | None:
        return self.texts.commit


def load_mentions(path: Path) -> MentionsFile:
    """crmedr's `data/mentions.json`, validated. A missing file means no mentions (a crmedr pin
    from before them), with a warning. A malformed one raises at once, naming the file, as a
    malformed `footnotes.json` does."""
    if not path.exists():
        log.warning("%s is missing: the eulogies are served without mentions.", path)
        return MentionsFile(editions={})
    try:
        return MentionsFile.model_validate_json(path.read_bytes())
    except ValidationError as err:
        raise ValueError(f"{path}: invalid mentions.json: {err}") from err


def span_check(words: str) -> str:
    """The first 8 hex digits of SHA-256 over the UTF-8 bytes of `words`, as printed: neither
    folded nor normalized."""
    return hashlib.sha256(words.encode("utf-8")).hexdigest()[:8]


def utf16_slice(s: str, start: int, end: int) -> str | None:
    """`s[start:end]` counted in UTF-16 code units; None when the span runs past the end of `s` or
    cuts a surrogate pair in two."""
    units = s.encode("utf-16-le")
    if end * 2 > len(units):
        return None
    try:
        return units[start * 2 : end * 2].decode("utf-16-le")
    except UnicodeDecodeError:
        return None


def lands(m: MentionIn, text: str | None, footnotes: list[FootnoteOut]) -> str | None:
    """The words the mention covers in `text`, or in the footnote it names, when they are the
    words crmedr checked; None when they are not, or are not there."""
    if isinstance(m.where, MentionFootnote):
        n = m.where.footnote
        target = footnotes[n - 1].text if n <= len(footnotes) else None
    else:
        target = text
    words = utf16_slice(target, m.start, m.end) if target is not None else None
    return words if words is not None and span_check(words) == m.check else None


def served(ms: list[MentionIn], text: str | None, footnotes: list[FootnoteOut]) -> list[MentionOut]:
    """The mentions that land in this text, as served: each with the words it covers as `form`."""
    out = []
    for m in ms:
        words = lands(m, text, footnotes)
        if words is not None:
            out.append(MentionOut.model_validate(m.model_dump(exclude={"check"}) | {"form": words}))
    return out
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `.venv/bin/pytest -q tests/test_mentions.py`
Expected: all pass.

- [ ] **Step 7: Lint, type-check, run everything**

Run: `.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright && .venv/bin/pytest -q`
Expected: clean, with every test passing. The new field defaults to `[]`, so no existing response changes except
for gaining `"mentions": []`.

If `ruff format --check` fails, run `.venv/bin/ruff format src tests` and re-check.

- [ ] **Step 8: Commit**

```bash
git add src/martyrology_api/models.py src/martyrology_api/mentions.py tests/test_mentions.py
git commit -F - <<'EOF'
Model the persons and places a eulogy names

crmedr's data/mentions.json gives each mention a span of a eulogy's text,
or of one of its footnotes, in UTF-16 code units, and a check: the first 8
hex digits of SHA-256 over the printed words, which crmedr does not store.
lands() reads the words from the API's own text and compares; served()
returns the mentions that land, with those words as `form`. A missing file
is no mentions, with a warning; a malformed one stops the service.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 2: The start-up check through the Store, and the texts commit

**Files:**
- Modify: `src/martyrology_api/mentions.py` (add `check_mentions`, `compare_texts_pins`, `_where`)
- Modify: `src/martyrology_api/store.py` (imports; `__init__`; three new methods)
- Create: `tests/fixtures/crmedr/data/mentions.json`
- Test: `tests/test_mentions.py` (append)

**Interfaces:**
- Consumes: `MentionIn`, `Mentions`, `MentionsFile`, `lands` (Task 1); `Store.footnotes(edition_id)`,
  `Store._load_month`.
- Produces:
  - `mentions.check_mentions(mentions: Mentions, attached: Collection[str], texts_of: Callable[[str], dict[str, str | None]], footnotes_of: Callable[[str], dict[str, list[FootnoteOut]]], texts_commit: str | None) -> Mentions`.
    It logs:
    - one WARNING per dropped mention, starting with `"Mention dropped:"`;
    - one INFO line per edition whose texts aren't attached;
    - one INFO summary: `"Mentions: N served, M dropped (offsets from martyrology-texts <commit>)."`, with
      `<commit>` reading `an unrecorded commit` when it is null.
  - `mentions.compare_texts_pins(extracted: str | None, deployed: str | None) -> None`. It logs a WARNING naming
    both commits when both are known and neither is a prefix of the other, since one may be abbreviated.
  - `Store.attach_mentions(file: MentionsFile) -> None`.
  - `Store.mentions(edition_id: str) -> dict[str, list[MentionIn]]`, which is `{}` before `attach_mentions` and
    for an edition without mentions.

The fixture texts it relies on (already in `tests/fixtures`):

| Edition | Eulogy | Text |
|---|---|---|
| 2004 | `mr:0102-concordius` | "Spoleti in Umbria, sancti Concordii, presbyteri et martyris." |
| 2004 | `mr:0102-argeus-et-socii` | footnote 1: "Quorum nomina: sancti Narcissus et Marcellinus." |
| 2004 `it_IT` | `mr:0102-concordius` | "A Spoleto, san Concordio, sacerdote e martire." |
| 1749 | `mr:0102-concordius`, printed on 01-01 | "Spoleti sancti Concordii, Presbyteri et Martyris." |

There are no 1630 texts in the fixtures.

- [ ] **Step 1: Generate the fixture's checks, then write the fixture**

Don't hand-type the checks; print them from the definition:

```bash
python3 -c '
import hashlib
for w in ["Spoleti in Umbria", "Concordii", "Narcissus", "Quorum", "Abc", "A Spoleto", "Spoleti"]:
    print(f"{w!r}: {hashlib.sha256(w.encode()).hexdigest()[:8]}")'
```

Expected output:

```
'Spoleti in Umbria': 46f1bf10
'Concordii': 4b9b016f
'Narcissus': 1ccf99a1
'Quorum': 18ed8b6c
'Abc': 06d90109
'A Spoleto': 06a91c1b
'Spoleti': 65380b11
```

Create `tests/fixtures/crmedr/data/mentions.json` with those values:

```json
{
  "$comment": "Test fixture: mentions in the fixture texts. Served: 5. Dropped: 3 (the check of \"Concordii\" over \"presbyteri\", a footnote the eulogy lacks, a eulogy the edition does not print). Not checked: 1630, whose texts are not attached. Each check is span_check of the words named in this comment.",
  "texts": { "commit": null },
  "editions": {
    "martyrologium_romanum_2004": {
      "mr:0102-concordius": [
        { "kind": "place", "where": "text", "start": 0, "end": 17, "check": "46f1bf10", "qid": "Q13363" },
        { "kind": "person", "where": "text", "start": 26, "end": 35, "check": "4b9b016f", "name": "Concordius", "qid": null },
        { "kind": "person", "where": "text", "start": 37, "end": 47, "check": "4b9b016f", "name": "Stale", "qid": null }
      ],
      "mr:0102-argeus-et-socii": [
        { "kind": "person", "where": { "footnote": 1 }, "start": 22, "end": 31, "check": "1ccf99a1", "name": "Narcissus", "qid": "Q1" },
        { "kind": "person", "where": { "footnote": 2 }, "start": 0, "end": 6, "check": "18ed8b6c", "name": "Nemo", "qid": null }
      ],
      "mr:0109-nusquam": [
        { "kind": "person", "where": "text", "start": 0, "end": 3, "check": "06d90109", "name": "Abc", "qid": null }
      ]
    },
    "martyrologium_romanum_2004_it_IT": {
      "mr:0102-concordius": [
        { "kind": "place", "where": "text", "start": 0, "end": 9, "check": "06a91c1b", "qid": "Q13363" }
      ]
    },
    "martyrologium_romanum_1749": {
      "mr:0102-concordius": [
        { "kind": "person", "where": "text", "start": 15, "end": 24, "check": "4b9b016f", "name": "Concordius", "qid": null }
      ]
    },
    "martyrologium_romanum_1630": {
      "mr:0102-concordius": [
        { "kind": "place", "where": "text", "start": 0, "end": 7, "check": "65380b11", "qid": "Q13363" }
      ]
    }
  }
}
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/test_mentions.py`:

```python
from martyrology_api.mentions import compare_texts_pins
from martyrology_api.registry import Registry
from martyrology_api.store import Store

ED = "martyrologium_romanum_2004"


def _store(crmedr_path, clbdr_path, data_paths) -> Store:
    return Store(data_paths, Registry.load(crmedr_path, clbdr_path))


def test_the_store_serves_no_mentions_before_they_are_attached(crmedr_path, clbdr_path, data_paths):
    assert _store(crmedr_path, clbdr_path, data_paths).mentions(ED) == {}


def test_the_fixture_checks_are_the_definitions(crmedr_path, clbdr_path, data_paths):
    # Every mention the fixture means to serve hashes, under the test's own _check, to the words
    # at its offsets in the fixture texts: the fixture and the definition agree.
    s = _store(crmedr_path, clbdr_path, data_paths)
    s.attach_mentions(load_mentions(crmedr_path / "data/mentions.json"))
    for edition in (ED, "martyrologium_romanum_2004_it_IT", "martyrologium_romanum_1749"):
        texts, notes = s._texts(edition), s.footnotes(edition)
        for cid, ms in s.mentions(edition).items():
            for m in ms:
                words = lands(m, texts[cid], notes.get(cid, []))
                assert words is not None and _check(words) == m.check


def test_the_store_keeps_the_mentions_that_land_and_logs_the_rest(
    crmedr_path, clbdr_path, data_paths, caplog
):
    caplog.set_level(logging.INFO, logger="martyrology_api.mentions")
    s = _store(crmedr_path, clbdr_path, data_paths)
    s.attach_mentions(load_mentions(crmedr_path / "data/mentions.json"))

    assert [(m.start, m.end) for m in s.mentions(ED)["mr:0102-concordius"]] == [(0, 17), (26, 35)]
    argeus = s.mentions(ED)["mr:0102-argeus-et-socii"]
    assert [(m.name, m.where) for m in argeus] == [("Narcissus", MentionFootnote(footnote=1))]
    assert "mr:0109-nusquam" not in s.mentions(ED)
    assert s.mentions("martyrologium_romanum_2004_it_IT")["mr:0102-concordius"][0].end == 9
    assert s.mentions("martyrologium_romanum_1749")["mr:0102-concordius"][0].start == 15
    assert s.mentions("martyrologium_romanum_1630") == {}

    dropped = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(dropped) == 3
    assert all(d.startswith("Mention dropped:") for d in dropped)
    assert any("mr:0102-concordius" in d and "37-47" in d and "4b9b016f" in d for d in dropped)
    assert any("footnote 2" in d for d in dropped)  # a footnote the eulogy lacks
    assert any("mr:0109-nusquam" in d for d in dropped)  # a eulogy the edition does not print
    assert (
        "Mentions: 5 served, 3 dropped (offsets from martyrology-texts an unrecorded commit)."
        in caplog.text
    )
    assert "martyrologium_romanum_1630" in caplog.text  # said once: its texts are not attached


@pytest.mark.parametrize(
    ("extracted", "deployed", "warned"),
    [
        ("4e89ec8", "4e89ec8d1c0ffee", False),  # one abbreviates the other
        ("4e89ec8d1c0ffee", "4e89ec8", False),
        ("4e89ec8", "1234567", True),
        (None, "1234567", False),  # crmedr did not record it: nothing to compare
        ("4e89ec8", None, False),  # no bundle manifest (development): nothing to compare
    ],
)
def test_a_texts_commit_other_than_the_one_served_is_warned_of(extracted, deployed, warned, caplog):
    caplog.set_level(logging.WARNING, logger="martyrology_api.mentions")
    compare_texts_pins(extracted, deployed)
    assert bool(caplog.records) is warned
    if warned:
        assert extracted in caplog.text and deployed in caplog.text
```

- [ ] **Step 3: Run them to see them fail**

Run: `.venv/bin/pytest -q tests/test_mentions.py`
Expected: an `ImportError` for `compare_texts_pins`. Once that is added, the Store tests fail with
`AttributeError: 'Store' object has no attribute 'mentions'`.

- [ ] **Step 4: Add `check_mentions` and `compare_texts_pins`**

Append to `src/martyrology_api/mentions.py` and add `from collections.abc import Callable, Collection` to its
imports:

```python
def _where(m: MentionIn) -> str:
    return f"footnote {m.where.footnote}" if isinstance(m.where, MentionFootnote) else "text"


def check_mentions(
    mentions: Mentions,
    attached: Collection[str],
    texts_of: Callable[[str], dict[str, str | None]],
    footnotes_of: Callable[[str], dict[str, list[FootnoteOut]]],
    texts_commit: str | None,
) -> Mentions:
    """The mentions that land on the words crmedr checked, in the attached texts. Each one that
    doesn't (its text corrected since crmedr's extraction, a footnote the eulogy lacks, a eulogy
    the edition does not print) is logged once and dropped; an edition whose texts are not
    attached is skipped. The count is logged at the end, with the texts commit the offsets came
    from."""
    kept: Mentions = {}
    served_n = dropped = 0
    for edition_id, by_id in mentions.items():
        if edition_id not in attached:
            log.info("The mentions of %s are not served: its texts are not attached.", edition_id)
            continue
        texts, notes = texts_of(edition_id), footnotes_of(edition_id)
        for cid, ms in by_id.items():
            for m in ms:
                if cid in texts and lands(m, texts[cid], notes.get(cid, [])) is not None:
                    kept.setdefault(edition_id, {}).setdefault(cid, []).append(m)
                    served_n += 1
                else:
                    dropped += 1
                    log.warning(
                        "Mention dropped: %s %s, %s at %d-%d does not match its check %s.",
                        edition_id,
                        cid,
                        _where(m),
                        m.start,
                        m.end,
                        m.check,
                    )
    log.info(
        "Mentions: %d served, %d dropped (offsets from martyrology-texts %s).",
        served_n,
        dropped,
        texts_commit or "an unrecorded commit",
    )
    return kept


def compare_texts_pins(extracted: str | None, deployed: str | None) -> None:
    """Warn when crmedr took the offsets from other texts than this deployment serves: its
    mentions then miss wherever the two differ. Either commit may be abbreviated; nothing is
    compared when either is unknown."""
    if extracted and deployed and not (
        extracted.startswith(deployed) or deployed.startswith(extracted)
    ):
        log.warning(
            "crmedr's mentions were taken from martyrology-texts %s, but this deployment serves "
            "%s: expect dropped mentions until the two pins agree.",
            extracted,
            deployed,
        )
```

- [ ] **Step 5: Teach the Store**

In `src/martyrology_api/store.py`:

- add to the imports: `from .mentions import Mentions, MentionsFile, MentionIn, check_mentions`;
- at the end of `Store.__init__`, after the `self._lunar` loop, add:

```python
        # Attached after start-up checks them against the texts (attach_mentions).
        self._mentions: Mentions = {}
```

- after `Store.lunar`, add:

```python
    def _texts(self, edition_id: str) -> dict[str, str | None]:
        """The edition's texts by canonical id, across its twelve months."""
        return {
            e.id: e.text
            for m in range(1, 13)
            for d in self._load_month(edition_id, m).values()
            for e in d.elogia
            if e.id is not None
        }

    def attach_mentions(self, file: MentionsFile) -> None:
        """Serve crmedr's mentions: those that land on the words crmedr checked, in the texts
        attached here (`mentions.check_mentions`, which logs the rest)."""
        self._mentions = check_mentions(
            file.editions, self._dirs.keys(), self._texts, self.footnotes, file.texts_commit
        )

    def mentions(self, edition_id: str) -> dict[str, list[MentionIn]]:
        """The persons and places the edition's eulogies name, by canonical id: text first, then
        the footnotes in order. Empty when the edition has none."""
        return self._mentions.get(edition_id, {})
```

Let `ruff check --fix` / `ruff format` order the import names.

- [ ] **Step 6: Run the tests to see them pass**

Run: `.venv/bin/pytest -q tests/test_mentions.py`
Expected: all pass.

- [ ] **Step 7: Lint, type-check, run everything**

Run: `.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright && .venv/bin/pytest -q`
Expected: clean, all passing.

- [ ] **Step 8: Commit**

```bash
git add src/martyrology_api/mentions.py src/martyrology_api/store.py tests/fixtures/crmedr/data/mentions.json tests/test_mentions.py
git commit -F - <<'EOF'
Check each mention against the text it points into

Store.attach_mentions keeps the mentions whose printed words, in the
eulogy's text or its nth footnote, hash to crmedr's check, and drops the
rest with one log line each and a count naming the martyrology-texts
commit the offsets came from: a text corrected since the extraction never
gets a span on the wrong words. compare_texts_pins warns when that commit
is not the one this deployment serves.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 3: Serve the mentions on every read route, and withhold them with the text

**Files:**
- Modify: `src/martyrology_api/app.py:84` (after `app.state.store = Store(...)`)
- Modify: `src/martyrology_api/routers/read.py` (`elogium_out`, `_day_content`, `get_elogia`, `get_elogium`)
- Modify: `src/martyrology_api/licensing.py` (`redact`)
- Test: `tests/test_mentions_api.py` (create), `tests/test_curation_api.py` (append one test)

**Interfaces:**
- Consumes: `load_mentions`, `served`, `MentionIn` (Task 1); `Store.attach_mentions`, `Store.mentions`,
  `compare_texts_pins` (Task 2); `manifest.load_manifest(path) -> Manifest | None`, whose `.data["texts"]` is the
  bundled texts commit.
- Produces: the wire shape that part 3 (frontend) relies on. A served eulogy looks like this:

```jsonc
{
  "id": "mr:0102-argeus-et-socii", "entry": 2, "asterisk": false, "unnumbered": false, "anchor_day": "01-02",
  "text": "…", "footnotes": [{ "mark": "1", "after": "sociorum", "text": "Quorum nomina: sancti Narcissus …" }],
  "marginalia": [], "errata": [],
  "mentions": [
    { "kind": "person", "where": { "footnote": 1 }, "start": 22, "end": 31, "qid": "Q1", "name": "Narcissus", "form": "Narcissus" }
  ]
}
```

- Footnote mentions sit in the eulogy's own `mentions` list, with `where: {"footnote": n}`. They are **not**
  nested inside `footnotes`.
- `name` is always present: null for a place. `check` is never served.
- `EditionPlacementOut` (in `/elogium/{id}` → `editions.<edition>`) carries the same `mentions` field.

- [ ] **Step 1: Write the failing API tests**

Create `tests/test_mentions_api.py`:

```python
import json
import logging
import shutil

import pytest

from martyrology_api.auth import Identity

ED = "martyrologium_romanum_2004"
SPOLETI = {"kind": "place", "where": "text", "start": 0, "end": 17, "qid": "Q13363",
           "name": None, "form": "Spoleti in Umbria"}
CONCORDII = {"kind": "person", "where": "text", "start": 26, "end": 35, "qid": None,
             "name": "Concordius", "form": "Concordii"}
NARCISSUS = {"kind": "person", "where": {"footnote": 1}, "start": 22, "end": 31, "qid": "Q1",
             "name": "Narcissus", "form": "Narcissus"}


def _by_id(elogia):
    return {e["id"]: e for e in elogia}


@pytest.fixture
def client(make_client):
    return make_client(restricted_texts_access="public")


def test_a_day_carries_each_eulogys_mentions_with_their_printed_words(client):
    b = client.get(f"/api/v1/elogia/edition/{ED}/01/02").json()
    e = _by_id(b["elogia"])
    assert e["mr:0102-concordius"]["mentions"] == [SPOLETI, CONCORDII]
    assert e["mr:0102-argeus-et-socii"]["mentions"] == [NARCISSUS]


def test_a_month_carries_them_and_a_eulogy_without_any_has_an_empty_list(client):
    b = client.get(f"/api/v1/elogia/edition/{ED}/01").json()
    assert _by_id(b["days"]["02"]["elogia"])["mr:0102-concordius"]["mentions"] == [SPOLETI, CONCORDII]
    assert all(e["mentions"] == [] for e in b["days"]["01"]["elogia"])


def test_a_single_eulogy_carries_them(client):
    b = client.get(f"/api/v1/elogia/edition/{ED}/01/02/concordius").json()
    assert b["elogia"][0]["mentions"] == [SPOLETI, CONCORDII]


def test_the_placements_carry_each_editions_own_mentions(client):
    b = client.get("/api/v1/elogium/mr:0102-concordius").json()["editions"]
    assert b[ED]["mentions"] == [SPOLETI, CONCORDII]
    assert [m["form"] for m in b["martyrologium_romanum_2004_it_IT"]["mentions"]] == ["A Spoleto"]
    assert [m["form"] for m in b["martyrologium_romanum_1749"]["mentions"]] == ["Concordii"]


class _SignedIn:
    async def identity(self, token):
        return Identity(subject="u1", username="j") if token == "good" else None


def test_withheld_texts_carry_no_mentions(make_client):
    # `form` quotes the copyrighted text: under a sign-in rule an anonymous caller gets none.
    c = make_client(restricted_texts_access="authenticated")
    day = c.get(f"/api/v1/elogia/edition/{ED}/01/02").json()
    assert day["metadata"]["access"] == "restricted-texts"
    assert all(e["mentions"] == [] for e in day["elogia"])
    month = c.get(f"/api/v1/elogia/edition/{ED}/01").json()
    assert all(e["mentions"] == [] for d in month["days"].values() for e in d["elogia"])
    one = c.get(f"/api/v1/elogia/edition/{ED}/01/02/concordius").json()
    assert one["elogia"][0]["mentions"] == []
    placements = c.get("/api/v1/elogium/mr:0102-concordius").json()["editions"]
    assert placements[ED]["mentions"] == []
    assert placements["martyrologium_romanum_2004_it_IT"]["mentions"] == []
    # A public-domain edition is not withheld.
    assert [m["form"] for m in placements["martyrologium_romanum_1749"]["mentions"]] == ["Concordii"]
    # Signed in, they come back.
    c.app.state.authenticator = _SignedIn()
    authed = c.get(f"/api/v1/elogia/edition/{ED}/01/02", headers={"Authorization": "Bearer good"})
    assert _by_id(authed.json()["elogia"])["mr:0102-concordius"]["mentions"] == [SPOLETI, CONCORDII]


def test_a_crmedr_without_mentions_serves_none(make_client, crmedr_path, tmp_path, caplog):
    older = tmp_path / "crmedr"
    shutil.copytree(crmedr_path, older)
    (older / "data/mentions.json").unlink()
    caplog.set_level(logging.WARNING, logger="martyrology_api.mentions")
    c = make_client(crmedr_path=older, restricted_texts_access="public")
    b = c.get(f"/api/v1/elogia/edition/{ED}/01/02").json()
    assert all(e["mentions"] == [] for e in b["elogia"])
    assert "mentions.json is missing" in caplog.text


def test_start_up_warns_when_the_offsets_come_from_other_texts_than_those_served(
    make_client, crmedr_path, tmp_path, caplog
):
    pinned = tmp_path / "crmedr"
    shutil.copytree(crmedr_path, pinned)
    f = pinned / "data/mentions.json"
    f.write_text(
        json.dumps(json.loads(f.read_text(encoding="utf-8")) | {"texts": {"commit": "aaaaaaa"}}),
        encoding="utf-8",
    )
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "bundle_format": 1,
                "api_version": "0.0.0",
                "api_commit": "c",
                "data": {"texts": "bbbbbbbbbbbb", "crmedr": "c", "clbdr": "c"},
                "python_requires": ">=3.12",
                "files": {},
            }
        ),
        encoding="utf-8",
    )
    caplog.set_level(logging.INFO, logger="martyrology_api.mentions")
    make_client(crmedr_path=pinned, manifest_path=str(manifest))
    assert "offsets from martyrology-texts aaaaaaa" in caplog.text
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("aaaaaaa" in w and "bbbbbbbbbbbb" in w for w in warnings)
```

Append to `tests/test_curation_api.py`:

```python
def test_a_draft_whose_text_changed_carries_no_mentions(client):
    # The start-up check passed on the published text; a draft's words may have moved since.
    url = "/api/v1/elogia/edition/martyrologium_romanum_1749/01/01"
    published = {e["id"]: e for e in client.get(url).json()["elogia"]}
    assert [m["form"] for m in published["mr:0102-concordius"]["mentions"]] == ["Concordii"]
    client.patch(
        "/api/v1/editions/martyrologium_romanum_1749/elogia/mr:0102-concordius",
        json={"text": "Draft only."},
        headers=AUTH,
    )
    draft = client.get(url, headers=AUTH | {"X-Curation-Branch": "curation/jdoe/edits"}).json()
    concordius = next(e for e in draft["elogia"] if e["id"] == "mr:0102-concordius")
    assert concordius["text"] == "Draft only."
    assert concordius["mentions"] == []
```

- [ ] **Step 2: Run them to see them fail**

Run: `.venv/bin/pytest -q tests/test_mentions_api.py tests/test_curation_api.py::test_a_draft_whose_text_changed_carries_no_mentions`
Expected: failures where `mentions` is `[]` but spans are expected, plus the start-up log test (nothing loads the
file yet). The redaction and missing-file tests may pass by accident; that's fine.

- [ ] **Step 3: Attach the mentions at start-up**

In `src/martyrology_api/app.py`, add `from .mentions import compare_texts_pins, load_mentions` to the imports
(`load_manifest` is already imported, since `healthz` uses it). Directly after
`app.state.store = Store(settings.data_path_list, registry)`, add:

```python
    mentions = load_mentions(settings.crmedr_path / "data/mentions.json")
    app.state.store.attach_mentions(mentions)
    # The bundle manifest knows which texts this deployment serves; outside a bundle, nothing does.
    manifest = load_manifest(settings.manifest_file)
    compare_texts_pins(mentions.texts_commit, manifest.data.get("texts") if manifest else None)
```

- [ ] **Step 4: Serve them**

In `src/martyrology_api/routers/read.py`:

- add `from ..mentions import MentionIn, served` to the imports;
- replace `elogium_out` with:

```python
def elogium_out(
    e: Elogium,
    footnotes: dict[str, list[FootnoteOut]] | None = None,
    marginalia: dict[str, list[MarginNoteOut]] | None = None,
    errata: dict[str, list[ErratumOut]] | None = None,
    mentions: dict[str, list[MentionIn]] | None = None,
) -> ElogiumOut:
    notes = list((footnotes or {}).get(e.id or "", []))
    return ElogiumOut(
        id=e.id,
        entry=e.entry,
        asterisk=e.asterisk,
        unnumbered=e.unnumbered,
        anchor_day=f"{e.anchor_month:02d}-{e.anchor_day:02d}",
        text=e.text,
        footnotes=notes,
        marginalia=list((marginalia or {}).get(e.id or "", [])),
        errata=list((errata or {}).get(e.id or "", [])),
        # Read from the text served: a draft whose words moved carries none of them, and `form`
        # is always the words this response prints.
        mentions=served((mentions or {}).get(e.id or "", []), e.text, notes),
    )
```

- give `_day_content` a last parameter, `mentions: dict[str, list[MentionIn]] | None = None`, and pass it on:
  `elogia=[elogium_out(e, footnotes, marginalia, errata, mentions) for e in d.elogia],`;
- in `get_elogia`, after `errata = store.errata(resolution.edition_id)`, add
  `mentions = store.mentions(resolution.edition_id)`, then pass it in the three places that build eulogies:
  - month: `_day_content(v, notes, margins, errata, luna_out(tables, luna_year, req.month, d, language), mentions)`
  - day: `c = _day_content(day_data, notes, margins, errata, luna, mentions)`
  - single: `elogia = [elogium_out(hit, notes, margins, errata, mentions)]`
- in `get_elogium`, after the `errata = …` line, add:

```python
        mentions = (
            served(store.mentions(p.edition_id).get(canonical_id, []), p.text, list(notes))
            if allowed
            else []
        )
```

  and pass `mentions=mentions,` to `EditionPlacementOut(...)`.

In `src/martyrology_api/licensing.py`, add to `redact`'s loop:

```python
        e.mentions = []
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `.venv/bin/pytest -q tests/test_mentions_api.py tests/test_curation_api.py`
Expected: all pass.

- [ ] **Step 6: Lint, type-check, run everything with coverage**

Run: `.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright && .venv/bin/pytest -q --cov --cov-branch`
Expected: clean, all passing, coverage ≥ 90%.

- [ ] **Step 7: Commit**

```bash
git add src/martyrology_api/app.py src/martyrology_api/routers/read.py src/martyrology_api/licensing.py tests/test_mentions_api.py tests/test_curation_api.py
git commit -F - <<'EOF'
Serve each eulogy's mentions, and withhold them with its text

Day, month and single-eulogy responses and /elogium placements carry
`mentions`: the persons and places crmedr found in the eulogy's text and
footnotes, each with `form`, the words it covers, read from the text
served and checked against crmedr's hash, so a curator's draft carries no
span its words have left. They are emptied wherever the text is withheld,
since `form` quotes it. Start-up logs the martyrology-texts commit the
offsets came from and warns when the bundle serves other texts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 4: Describe the mentions in the OpenAPI document

The read routes declare no response model today, so the OpenAPI document shows their 200 body as `{}`, and
`ElogiumOut`, `FootnoteOut` and the rest are not in it at all. Declaring the models with `responses=` documents them
**without** re-validating every month response.

**Files:**
- Modify: `src/martyrology_api/routers/read.py` (the two `@router.get` decorators; `DayOut`, `MonthOut` and
  `EulogyOut` are already imported)
- Test: `tests/test_openapi.py` (append)

**Interfaces:**
- Consumes: `MentionOut`, plus `ElogiumOut.mentions` and `EditionPlacementOut.mentions` (Task 1).
- Produces: OpenAPI components `MentionOut`, `MentionFootnote`, `ElogiumOut`, `DayOut`, `MonthOut` and `EulogyOut`.
  The `/api/v1/elogia/{rest}` 200 response is `anyOf [DayOut, MonthOut]`, and `/api/v1/elogium/{canonical_id}`
  is `EulogyOut`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_openapi.py`:

```python
def test_openapi_documents_the_mentions_of_a_eulogy(client):
    schema = client.app.openapi()
    c = schema["components"]["schemas"]
    mention = {"$ref": "#/components/schemas/MentionOut"}
    assert c["ElogiumOut"]["properties"]["mentions"]["items"] == mention
    assert c["EditionPlacementOut"]["properties"]["mentions"]["items"] == mention
    m = c["MentionOut"]
    assert set(m["required"]) == {"kind", "where", "start", "end", "form"}
    assert "check" not in m["properties"]  # crmedr's hash is not part of the response
    assert m["properties"]["kind"]["enum"] == ["person", "place"]
    assert c["MentionFootnote"]["properties"]["footnote"]["minimum"] == 1
    elogia = schema["paths"]["/api/v1/elogia/{rest}"]["get"]["responses"]["200"]
    assert elogia["content"]["application/json"]["schema"]["anyOf"] == [
        {"$ref": "#/components/schemas/DayOut"},
        {"$ref": "#/components/schemas/MonthOut"},
    ]
    one = schema["paths"]["/api/v1/elogium/{canonical_id}"]["get"]["responses"]["200"]
    assert one["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/EulogyOut"}
```

- [ ] **Step 2: Run it to see it fail**

Run: `.venv/bin/pytest -q tests/test_openapi.py::test_openapi_documents_the_mentions_of_a_eulogy`
Expected: `KeyError: 'ElogiumOut'`.

- [ ] **Step 3: Declare the response models**

In `src/martyrology_api/routers/read.py`, change the two decorators:

```python
# Documented, not validated: a month response is large, and the handlers build these models.
@router.get("/elogia/{rest:path}", responses={200: {"model": DayOut | MonthOut}})
```

```python
@router.get("/elogium/{canonical_id}", responses={200: {"model": EulogyOut}})
```

- [ ] **Step 4: Run the OpenAPI tests**

Run: `.venv/bin/pytest -q tests/test_openapi.py`
Expected: all pass, including `test_openapi_schema_is_valid` (the 3.1 validator).

If `MentionOut` shows up as `MentionBase` or is inlined, check that `ElogiumOut.mentions` is annotated
`list[MentionOut]`, not `list[MentionBase]`.

- [ ] **Step 5: Lint, type-check, run everything**

Run: `.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright && .venv/bin/pytest -q`
Expected: clean, all passing.

- [ ] **Step 6: Commit**

```bash
git add src/martyrology_api/routers/read.py tests/test_openapi.py
git commit -F - <<'EOF'
Document the read responses, mentions included, in the OpenAPI schema

The elogia and elogium routes declared no response model, so their bodies
were {} in the schema. They now name DayOut | MonthOut and EulogyOut
(documented, not re-validated), which brings in ElogiumOut and its
MentionOut.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 5: Pin the crmedr that carries `mentions.json`, and check it on the real texts

**Prerequisite:** part 1's crmedr PR is merged, so `data/mentions.json` is on crmedr's `main`. If it isn't, stop
here: Tasks 1–4 can be reviewed and merged on their own, since a pin without the file serves `mentions: []` (Task
3's missing-file test).

**Files:**
- Modify: `vendor/crmedr` (submodule pointer), `Dockerfile:13` (`ARG CRMEDR_REF`)
- Test: `tests/test_smoke_realdata.py` (append)

**Interfaces:**
- Consumes: `load_mentions` (Task 1); the app as wired in Task 3.
- Produces: a pinned crmedr whose `data/mentions.json` loads with 0 dropped against the pinned texts.

- [ ] **Step 1: Write the real-data contract test**

Append to `tests/test_smoke_realdata.py`:

```python
def test_crmedrs_mentions_load_and_validate():
    from martyrology_api.mentions import load_mentions

    path = CRMEDR / "data/mentions.json"
    if not path.exists():
        pytest.skip("this crmedr has no mentions.json yet")
    mentions = load_mentions(path)
    assert {"martyrologium_romanum_2004", "martyrologium_romanum_2004_it_IT"} <= mentions.editions.keys()
    assert sum(len(ms) for by in mentions.editions.values() for ms in by.values()) > 1000
    assert mentions.texts_commit, "crmedr should record the martyrology-texts commit it read"
```

Run: `.venv/bin/pytest -q tests/test_smoke_realdata.py`
Expected: passes against the sibling `../crmedr` checkout (on `main`, after part 1).

- [ ] **Step 2: Move the pin, and line the texts pin up with it**

```bash
git -C vendor/crmedr fetch origin main
SHA=$(git -C vendor/crmedr rev-parse origin/main)
git -C vendor/crmedr checkout "$SHA"
test -f vendor/crmedr/data/mentions.json || { echo "crmedr main has no mentions.json"; exit 1; }
sed -i "s/^ARG CRMEDR_REF=.*/ARG CRMEDR_REF=$SHA/" Dockerfile
grep -n "^ARG CRMEDR_REF" Dockerfile
python3 -c 'import json; print("offsets from texts", json.load(open("vendor/crmedr/data/mentions.json"))["texts"]["commit"])'
git -C vendor/texts rev-parse HEAD
```

Expected: the `ARG` line shows the new SHA, and the two texts commits printed last agree (one may be abbreviated).

If they don't agree, move `vendor/texts` (and the Dockerfile's texts ref, if it has one:
`grep -n "TEXTS_REF" Dockerfile`) to the commit crmedr read. Do that only if it is on `martyrology-texts` `main`.
The two pins move together, as commit `8246bd5` did ("Both pins move together so the registry and the texts
agree"). If that commit is older than the current texts pin, stop and ask: crmedr should re-extract against the
current texts instead.

- [ ] **Step 3: Check the mentions against the real, pinned texts**

`vendor/texts` holds the private 2004 texts locally. Run:

```bash
.venv/bin/python - <<'EOF'
import logging, os
from pathlib import Path
from fastapi.testclient import TestClient
from martyrology_api.app import create_app
from martyrology_api.config import Settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
s = Settings(
    _env_file=None,
    data_path=os.pathsep.join(["data/editions", "vendor/texts/data/editions"]),
    crmedr_path=Path("vendor/crmedr"),
    clbdr_path=Path("vendor/clbdr"),
    restricted_texts_access="public",
)
c = TestClient(create_app(s))
for ed in ("martyrologium_romanum_2004", "martyrologium_romanum_2004_it_IT"):
    b = c.get(f"/api/v1/elogia/edition/{ed}/01/01").json()
    print(ed, [(e["id"], [(m["kind"], m["form"]) for m in e["mentions"]]) for e in b["elogia"][:3]])
EOF
```

Expected:
- the log line `Mentions: N served, 0 dropped (offsets from martyrology-texts <sha>).`, with N in the thousands;
- for 2004, `mr:0101-basilius` carries `("place", "Cæsaréæ in Cappadócia")` and `("person", "Basilíi")`;
- for `it_IT`, `mr:0101-basilius` carries its Italian place.

**If any mention is dropped**, read the `Mention dropped:` lines:
- If they cluster in a few eulogies, those texts changed after crmedr's extraction. Ask for crmedr to re-extract.
- If they are scattered, it's an offset or hashing bug in part 1. Stop and report it against the crmedr PR, with
  one dropped mention's span and the check the API computed. Don't paper over it here.

- [ ] **Step 4: Run everything**

Run: `.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts && .venv/bin/pyright && .venv/bin/pytest -q`
Expected: clean, all passing.

- [ ] **Step 5: Commit**

```bash
git add vendor/crmedr Dockerfile tests/test_smoke_realdata.py
git commit -F - <<'EOF'
Bump the crmedr data pin (mentions of persons and places)

crmedr <short-sha> adds data/mentions.json, the persons and places named in
the 2004 Latin and Italian texts, with offsets taken from martyrology-texts
<texts-sha>, the texts pinned here. Checked at start-up: <N> served, 0
dropped.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

Fill in the three values before committing; each is only known at this point:
- `<short-sha>`: `git -C vendor/crmedr log -1 --format=%h`
- `<texts-sha>`: Step 2's output
- `<N>`: Step 3's log line

If Step 2 moved `vendor/texts` too, add it to the `git add` and say so in the message.

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin feat/mentions
gh pr create --title "Serve the persons and places each eulogy names" --body-file - <<'EOF'
## Summary
- Each eulogy in day, month and single-eulogy responses, and each `/elogium` placement, carries `mentions`: the
  persons and places crmedr found in its text and footnotes (`kind`, `where`, `start`/`end` in UTF-16 code units,
  `qid`, `name`, and `form`, the words covered).
- crmedr stores no printed words. Each mention carries a `check` (8 hex digits of SHA-256 over the printed span),
  and the API reads `form` from its own text.
- At start-up, mentions whose words don't hash to their check are dropped and logged, with a count and the
  martyrology-texts commit the offsets came from. A warning fires when the bundle serves other texts.
- Served mentions are re-checked against the text actually served, so a curator's draft carries none that no
  longer fit.
- Mentions are withheld with the text, because `form` quotes it.
- A crmedr pin without `mentions.json` serves `mentions: []` with a warning.
- The read routes now declare their response models in the OpenAPI document, which brings in `ElogiumOut` and
  `MentionOut`.
- Bumps the crmedr pin to the one carrying `data/mentions.json`.

Part 2 of 4 of the eulogy markup design (martyrology-frontend `docs/superpowers/specs/2026-10-09-eulogy-markup-design.md`).

## Test plan
- [x] `pytest` (the check's known vector, UTF-16 offsets, served and dropped mentions, footnote numbering,
  redaction under `authenticated`, a draft read, a missing file, the texts-pin warning, OpenAPI), `ruff`,
  `ruff format --check`, `pyright`
- [x] Real texts: `Mentions: <N> served, 0 dropped.`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

- [ ] **Step 7: After merge, the release**

The repo releases in a separate PR (`chore/release-x.y.z`, "Bump version to x.y.z"). A new response field is a
minor version:

```bash
git checkout main && git pull && git checkout -b chore/release-0.16.0
sed -i 's/^version = "0.15.3"/version = "0.16.0"/' pyproject.toml
sed -i 's/^__version__ = "0.15.3"/__version__ = "0.16.0"/' src/martyrology_api/__init__.py
uv lock
git add pyproject.toml src/martyrology_api/__init__.py uv.lock
git commit -m "Bump version to 0.16.0" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

If `main`'s version is no longer 0.15.3 by then, use the next minor version after it.

---

## Self-Review

- **Spec coverage, "martyrology-api" section and the settled contract:**

  | Requirement | Covered by |
  |---|---|
  | Loading at start-up from vendored crmedr | Task 3 step 3; Task 5 |
  | The check (SHA-256, 8 hex digits, UTF-8 over the UTF-16 span, unfolded), text or footnote *n* | Tasks 1–2 |
  | Drop and log once | Task 2 |
  | Count, and the texts commit | Task 2 |
  | Texts-commit mismatch warning | Tasks 2–3 |
  | `mentions` on day, month and single-eulogy responses | Task 3 |
  | Empty list when there are none | Tasks 1, 3 |
  | Served fields, with `form` from the API's own slice and `name` always present | Tasks 1, 3 |
  | Withheld with the text | Task 3, `redact` and `get_elogium` |
  | OpenAPI schema | Task 4 |
  | Edition list unchanged | no task touches it |

  Single-eulogy here means both `/elogia/…/<slug>` and `/elogium/{id}` placements.
- **Placeholders:** `<short-sha>`, `<texts-sha>` and `<N>` in Task 5's commit and PR text are values that exist only
  at that step, and the step says how to get each.
- **Type consistency:**
  - `MentionBase` / `MentionIn` / `MentionOut`, `Mentions` (lists of `MentionIn`), `MentionsFile.texts_commit`,
    `span_check`, `lands -> str | None`, `served`, `check_mentions(…, texts_commit)`, `compare_texts_pins`,
    `Store.attach_mentions(file)`, `Store.mentions -> dict[str, list[MentionIn]]` and `Store._texts` are used with
    the same signatures in every task.
  - `_day_content`'s new parameter comes after `luna`, so the existing positional calls stay valid.
- **Review Focus:** each of the five items names its test in its owning task.

## Spec gaps found while planning

1. **Drafts:** the spec checks spans only at start-up. A curator's draft read (`X-Curation-Branch`) serves branch
   texts the check never saw. This plan re-checks every served mention against the text actually served (`served()`
   in `elogium_out`), which also fills `form` from that text.
2. **OpenAPI:** the read routes had no response models, so no eulogy schema existed to add `Mention` to. Task 4
   declares them (documented, not validated).
3. **Schema name:** the spec's `Mention` becomes `MentionOut`, following the repo's convention.
4. **Missing file:** the spec doesn't say what a crmedr pin without `mentions.json` does. Decided: warn, and serve
   `[]`.
5. **Superseded by the contract:** the spec's `form` in `mentions.json` is now `check`, and the texts commit is now
   recorded as `texts.commit`. The spec document itself still describes `form` in the file and should be amended to
   match.
