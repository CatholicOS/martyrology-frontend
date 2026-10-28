import type { PlaceRole } from "@/lib/body-places";

export type Decision = null | "accept" | "reject" | "edit";

export interface TextSays {
  country: string;
  it: string;
}

export interface EditedFields {
  new_id?: string;
  subject_la?: string;
  winner?: string;
  reason?: string;
  // resolve_place (text_says is derived by crmedr's apply, never chosen)
  wikidata?: string;
  country?: string;
  /** resolve_place: the place lies in no single country (a macro-area such as the Orient); no `country`. */
  no_country?: boolean;
  /** resolve_place: the place lies in several countries (Frisia: NL, DE); no `country`. */
  countries?: string[];
  // add_place: the item's fields; null removes an optional one
  role?: PlaceRole;
  la?: string;
  it?: string | null;
  person?: string | null;
  n?: number | null;
  occurrence?: number | null;
  occurrence_it?: number | null;
  // realign
  action?: RealignAction;
  /** An empty string removes the proposed link. */
  same_eulogy_with?: string;
  parts?: SplitPart[];
  first_id?: string;
  /** realign: a curator note. attach_note (a mark without a note): the ref of the day's note it takes. */
  note?: string;
  // attach_note: the eulogy, the anchor phrase (null: the mark at the end) and the letter
  id?: string;
  after?: string | null;
  mark?: string;
  // add_mention, set_span: the words the curator chose, as offsets in the eulogy's text (or the footnote's)
  start?: number;
  end?: number;
  form?: string;
  /** relabel: the eulogy's subjects in three languages (null leaves one empty). */
  labels?: SubjectLabels;
  /** set_persons: the eulogy's text persons, in printed order. */
  persons?: ListedPerson[];
}

export interface DecisionRecord {
  decision: Exclude<Decision, null>;
  edited?: EditedFields;
  /** Review-page bookkeeping, never exported: what an accept resolved to when it was saved. */
  target?: string;
}

interface Base {
  /** An explicit unique key, for change-sets that hold several ops on one id. */
  uid?: string;
  class?: string;
  confidence?: string;
  incipit?: string;
  reasoning?: string;
  decision: Decision;
  edited?: EditedFields | null;
}

export type RenameCategory =
  | "surname"
  | "place-genitive"
  | "place-adjective"
  | "role"
  | "role-place"
  | "epithet"
  | "twin"
  | "papa"
  | "biblical-title";

/** One ranked ID a subject-identity rename may take (crmedr subject identity). */
export interface RenameCandidate {
  new_id: string;
  category: RenameCategory;
  weak: boolean;
  certain?: boolean;
  labels: { la: string | null; en: string | null; it: string | null };
  /** "bare-name draft" marks the earlier draft. */
  basis: string;
  draft_class?: string;
}

/** Jev's suggestion on a rename card: never a decision by itself. Without `decision`, Jev doubts the record. */
export interface RenameJev {
  decision?: "accept" | "edit";
  /** An edit's chosen candidate. */
  new_id?: string;
  probability?: number;
  confidence?: number;
  model: string;
  flags: string[];
  /** Candidate ID → clarity score, 0..3. */
  scores: Record<string, number>;
}

/** Jev's suggestion on a person card: never a decision by itself. */
export interface PersonJev {
  decision: "accept" | "edit" | "reject";
  /** accept/edit: the item. */
  wikidata?: string;
  source?: string;
  /** reject: why. */
  reason?: string;
  kind?: string;
  probability: number;
  confidence: number;
  model: string;
  flags?: string[];
}

export interface RenameOp extends Base {
  op: "rename";
  id: string;
  new_id: string;
  subject_la?: string;
  candidates?: RenameCandidate[];
  jev?: RenameJev | null;
}

/** A eulogy's subjects in Latin, English and Italian; null where a language has none. */
export interface SubjectLabels {
  la: string | null;
  en: string | null;
  it: string | null;
}

/** One subjects set a relabel may take: a candidate rename's labels, or the current set (`from_id` null, always last). */
export interface RelabelCandidate {
  labels: SubjectLabels;
  from_id: string | null;
}

/** Jev's pick on a relabel card, from earlier crmedr runs: no longer asked, never shown (the subject follows the ID). */
export interface RelabelJev {
  decision?: "accept" | "edit" | "reject";
  /** An edit's chosen labels. */
  labels?: SubjectLabels;
  probability?: number;
  confidence?: number;
  model: string;
  flags?: string[];
  /** One score per candidate, in candidate order. */
  scores?: number[];
}

/** A reference for a relabel's wording: the decided item of the eulogy's one person, never a choice. */
export interface RelabelHint {
  wikidata: string;
  labels: { en: string | null; it: string | null };
}

/**
 * A eulogy's subject (crmedr subject identity): it follows the eulogy's decided ID. Accept writes the
 * subject that ID implies, edit the edited labels, reject keeps the current subject.
 */
export interface RelabelOp extends Base {
  op: "relabel";
  id: string;
  current: SubjectLabels;
  labels: SubjectLabels;
  /** One per distinct subject of the rename candidates (from_id: the new ID it came from), then the current set. */
  candidates: RelabelCandidate[];
  /** From earlier runs; ignored. */
  jev?: RelabelJev | null;
  /** From earlier runs (crmedr no longer prefills a relabel); ignored. */
  prefilled?: "jev";
  hint?: RelabelHint;
}

export interface DeleteOp extends Base {
  op: "delete";
  id: string;
  reason?: string;
}

export interface MergeOp extends Base {
  op: "merge";
  ids: string[];
  winner: string;
}

/** A Wikidata candidate for a place, as written by crmedr's scripts/build_gazetteer.py. */
export interface PlaceCandidate {
  wikidata: string;
  label: string;
  description: string;
  /** The single current country (ISO 3166-1 alpha-2), or null. */
  country: string | null;
  countries: string[];
  la: string[];
  p9314: boolean;
  coords: [number, number] | null;
  types: string[];
  evidence: string[];
}

/** Jev's suggestion on a place card: never a decision by itself. `decision` is absent only for a place with no candidates. */
export interface PlaceJev {
  decision?: "accept" | "edit" | "reject";
  /** accept/edit: the item, and its country when the candidate has one. */
  wikidata?: string;
  country?: string;
  /** reject: why. */
  reason?: string;
  kind: "place" | "people" | "relative" | "not_place";
  probability: number;
  confidence: number;
  model: string;
}

/** Resolve a printed Latin place designation to a Wikidata item (crmedr gazetteer). */
export interface ResolvePlaceOp extends Base {
  op: "resolve_place";
  /** The Latin place designation as printed; also the op's key. */
  id: string;
  la: string;
  it: string[];
  occurrences: string[];
  claims: TextSays[];
  failed: string[];
  candidates: PlaceCandidate[];
  /** The researched item and its country, or its countries when it lies in several (Jerusalem: IL, PS), or no_country for one in none (the Orient). */
  suggested?: { wikidata: string; country?: string; countries?: string[]; no_country?: boolean } | null;
  jev?: PlaceJev;
  /** Set when crmedr pre-filled the decision from Jev's pick. */
  prefilled?: "jev";
}

/**
 * A place a eulogy names outside its opening place, with its role (crmedr's
 * scripts/body_places.py). `la` / `it` are the place designation as printed in the
 * Latin and Italian 2004 texts; `occurrence` / `occurrence_it` pick the printing when
 * it is printed more than once; `person` / `n` say whose role it is. `persons` lists
 * the eulogy's persons when it has several. Keyed `<eulogy>#<role>#<la>[#occ][#person[#n]]`.
 */
export interface AddPlaceOp extends Base {
  op: "add_place";
  id: string;
  eulogy: string;
  role: PlaceRole;
  la: string;
  it?: string;
  person?: string;
  n?: number;
  occurrence?: number;
  occurrence_it?: number;
  persons?: { name: string; n?: number }[];
}

/** A Wikidata candidate for a person, as written by crmedr's scripts/build_person_items.py. */
export interface PersonCandidate {
  wikidata: string;
  label: string;
  description: string;
  names: string[];
  human: boolean;
  statuses: string[];
  born: string | null;
  died: string | null;
  feast: string[];
  evidence: string[];
  /** search | companion:Pnnn | sparql | title | curated | place */
  source?: string;
  /** The places of the eulogy this candidate's Wikidata item agrees with, and through which property. */
  places?: { role: string; qid: string; label?: string; via: "P19" | "P20" | "P119" | "P937" }[];
  /** The candidate's own places, by role, as labels. */
  place_labels?: { death_place?: string[]; burial_place?: string[]; birth_place?: string[]; work_places?: string[] };
}

/** Identify a saint or blessed named in a eulogy with a Wikidata item (crmedr persons). */
export interface ResolvePersonOp extends Base {
  op: "resolve_person";
  /** `<eulogy>|<name>`, or `<eulogy>|<name>#<n>` for the nth person of a name. */
  id: string;
  eulogy: string;
  day: string;
  typology: string | null;
  subject: string;
  name: string;
  /** Which person of the name in the eulogy, from 2; absent for the first. */
  n?: number;
  /** The person's other names. */
  also?: string[];
  where: "text" | { footnote: number };
  companions: string[];
  failed: string[];
  /** The places named in the eulogy, which the candidates were checked against. */
  places?: { role: string; label: string; qid: string }[];
  candidates: PersonCandidate[];
  suggested?: { wikidata: string } | null;
  jev?: PersonJev | null;
}

/** A person of a set_persons list: the Latin nominative and, when the Italian prints it otherwise, its Italian form. */
export interface ListedPerson {
  name: string;
  it?: string | null;
}

/** A drafted person: one read now, or one drafted from a printed form not read (with the other readings). */
export interface ProposedPerson extends ListedPerson {
  n?: number;
  also?: string[];
  printed?: string;
  alternatives?: string[];
}

/**
 * The persons of a eulogy whose list of names crmedr could not read to its end (persons_review.py):
 * the names read now, the printed forms not read, and a list drafted through to its end. Accept writes
 * the drafted list, edit an edited one, reject keeps the names as read.
 */
export interface SetPersonsOp extends Base {
  op: "set_persons";
  id: string;
  current: string[];
  unread: string[];
  persons: ProposedPerson[];
}

export type RealignAction = "rename" | "rekey" | "split" | "merge" | "link" | "note" | "rubric";

/** One eulogy a run-in key's text is split into, from `split_at` up to the next part. */
export interface SplitPart {
  split_at: string;
  id: string;
  /** Whether `id` is a current or deprecated registry ID, or a new one to coin. */
  target?: "current" | "deprecated" | "new";
  subject_la?: string;
}

/**
 * How one historical edition keys one eulogy (crmedr #51): re-mint a garbled slug
 * (rename, every edition), move the edition's text to another ID (rekey), split a
 * key holding several eulogies (split), merge into a same-day ID, link a eulogy to
 * its counterpart on another day (link, `same_eulogy`), record a curator note, or
 * turn a key that is a rubric into the day's `rubricae` (rubric). The texts are the
 * public-domain historical ones the op is about, carried in the change-set.
 */
export interface RealignOp extends Base {
  op: "realign";
  id: string;
  /** The historical edition the finding was read in ("1749", "1914"). */
  edition: string;
  action: RealignAction;
  new_id?: string;
  target?: "current" | "deprecated" | "new";
  subject_la?: string;
  same_eulogy_with?: string;
  parts?: SplitPart[];
  /** The ID the text before the first split point takes. */
  first_id?: string;
  explanation?: string;
  evidence?: string;
  /** id → edition → text. */
  texts?: Record<string, Record<string, string>>;
}

export type AttachNoteClass = "no-mark" | "letter-differs" | "unanchored" | "mark-without-note";

/** One of the day's notes, as an attach_note op lists them: `ref` is its key ("M-D|letter"). */
export interface NoteRef {
  ref: string;
  mark: string;
  lemma: string;
}

/**
 * Where one of Baronius's notes in the 1630 edition is attached (martyrology-api's
 * scripts/notationes_1630.py): the eulogy and the phrase its letter follows. Keyed "M-D|letter";
 * a letter printed in a eulogy with no note found (class "mark-without-note") has uid
 * "M-D|letter|mark" and no lemma or note. Reject: not a note of the day (not a reference letter).
 */
export interface AttachNoteOp extends Base {
  op: "attach_note";
  id: string;
  /** "M-D" */
  day: string;
  mark: string;
  lemma: string | null;
  /** The note's text. */
  note: string | null;
  proposed: { id: string; after: string | null };
  /** The day's eulogies, ID → 1630 text. */
  texts: Record<string, string>;
  notes: NoteRef[];
  scan_page: number;
}

/** A note or a eulogy on a scan page, that a margin note may stand beside. */
export interface MarginCandidate {
  /** "M-D|letter" for a note, the eulogy's ID for a eulogy. */
  ref: string;
  kind: "note" | "eulogy";
  lemma: string | null;
  /** Its opening words. */
  words: string;
}

/**
 * A margin note of the 1630 edition and the note (or eulogy) it stands beside, keyed
 * "<scan page>|<block key>". Reject: not a margin note.
 */
export interface PlaceMarginOp extends Base {
  op: "place_margin";
  id: string;
  text: string;
  proposed: { note?: string; id?: string } | null;
  candidates: MarginCandidate[];
  scan_page: number;
  /** The page on Internet Archive. */
  image: string;
}

/** Where a mention is printed: the eulogy's text, or its nth footnote. */
export type MentionWhere = "text" | { footnote: number };

export type MentionKind = "person" | "place";

/**
 * A person or place a eulogy names, as crmedr's scripts/extract_mentions.py proposes it. Offsets are
 * UTF-16 code units in the eulogy's text, or in the footnote's when `where` is a footnote. `context`
 * quotes a few words either side, from `context_start`, so the card can show the span without the
 * whole text. These change-sets quote the 2004 edition: they live in CHANGESETS_DIR, never in the repo.
 */
interface MentionBase extends Base {
  /** `<edition>|<eulogy>|<where>|<start>`, `<where>` "text" or "footnote:<n>"; without a span, it ends in the name. */
  id: string;
  edition: string;
  eulogy: string;
  where: MentionWhere;
  kind: MentionKind;
  /** A person's nominative in crmedr's persons.json. */
  name?: string;
  context: string;
  context_start: number;
}

/** Jev's suggestion on a mention card (crmedr scripts/suggest_mentions.py): never a decision by itself. */
export interface MentionSuggestion {
  decision: "accept" | "reject" | "edit";
  /** An edit's words, in the same offsets as the op. */
  start?: number;
  end?: number;
  form?: string;
  probability: number;
  confidence: number;
  model: string;
}

/** Mark words not marked yet. No span (all null): crmedr could not find the person; the curator picks the words. */
export interface AddMentionOp extends MentionBase {
  op: "add_mention";
  /** Which person of the name in the eulogy, from 2; absent for the first. */
  n?: number;
  start: number | null;
  end: number | null;
  form: string | null;
  /** Jev's suggestion, when its confidence reached crmedr's threshold. */
  suggested?: MentionSuggestion | null;
}

/** Move a mark: the words it covers now (`from`) and the words it should cover (`to`). */
export interface SetSpanOp extends MentionBase {
  op: "set_span";
  from: { start: number; end: number };
  to: { start: number; end: number; form: string };
}

/** Remove a mark crmedr doubts: a person inside a place phrase, or a stem that matched in several places. */
export interface RemoveMentionOp extends MentionBase {
  op: "remove_mention";
  start: number;
  end: number;
  form: string;
}

export type MentionOp = AddMentionOp | SetSpanOp | RemoveMentionOp;

export interface UnknownOp extends Base {
  op: string;
  id?: string;
  [k: string]: unknown;
}

export type Op =
  | RenameOp
  | RelabelOp
  | DeleteOp
  | MergeOp
  | ResolvePlaceOp
  | AddPlaceOp
  | ResolvePersonOp
  | RealignOp
  | AttachNoteOp
  | PlaceMarginOp
  | AddMentionOp
  | SetSpanOp
  | RemoveMentionOp
  | SetPersonsOp
  | UnknownOp;

export interface Changeset {
  schema: "crmedr-changeset/v1";
  generated_by: string;
  generated_at?: string;
  base: { edition: string; registry: string };
  operations: Op[];
}

export function parseChangeset(text: string): Changeset {
  const cs = JSON.parse(text);
  if (cs?.schema !== "crmedr-changeset/v1") {
    throw new Error(`Unsupported change-set schema: ${cs?.schema}`);
  }
  if (!Array.isArray(cs.operations)) {
    throw new Error("change-set has no operations[]");
  }
  // A place candidate without evidence (a hand-built crmedr card) would crash every PlaceCard.
  const operations = (cs.operations as Op[]).map((op) => {
    // A relabel without candidates (a hand-built card) gets an empty list, as a place without evidence does.
    if (op.op === "relabel") {
      const r = op as RelabelOp;
      const empty = (): SubjectLabels => ({ la: null, en: null, it: null });
      return {
        ...r,
        current: r.current ?? empty(),
        labels: r.labels ?? empty(),
        candidates: Array.isArray(r.candidates) ? r.candidates.map((c) => ({ ...c, labels: c.labels ?? empty() })) : [],
      } as RelabelOp;
    }
    if (op.op !== "resolve_place" || !Array.isArray(op.candidates)) return op;
    const place = op as ResolvePlaceOp;
    return { ...place, candidates: place.candidates.map((c) => ({ ...c, evidence: c.evidence ?? [] })) };
  });
  return { ...cs, operations } as Changeset;
}

export function isAdjudicable(op: Op): boolean {
  return (
    op.op === "rename" ||
    op.op === "relabel" ||
    op.op === "delete" ||
    op.op === "merge" ||
    op.op === "resolve_place" ||
    op.op === "add_place" ||
    op.op === "resolve_person" ||
    op.op === "realign" ||
    op.op === "attach_note" ||
    op.op === "place_margin" ||
    op.op === "add_mention" ||
    op.op === "set_span" ||
    op.op === "remove_mention" ||
    op.op === "set_persons"
  );
}

export function isMentionOp(op: Op): op is MentionOp {
  return op.op === "add_mention" || op.op === "set_span" || op.op === "remove_mention";
}

export function opId(op: Op): string {
  if (typeof op.uid === "string" && op.uid !== "") return op.uid;
  if (op.op === "merge") return (op as MergeOp).ids.join("+");
  // Without a uid a relabel must not collide with a rename of the same id.
  if (op.op === "relabel") return `relabel:${op.id}`;
  return (op as { id?: string }).id ?? JSON.stringify(op);
}

export function exportChangeset(
  cs: Changeset,
  decisions: Record<string, DecisionRecord>
): Changeset {
  return {
    ...cs,
    generated_by: "curation-ui",
    operations: cs.operations.map((op) => {
      const d = decisions[opId(op)];
      return d
        ? { ...op, decision: d.decision, edited: d.edited ?? null }
        : { ...op, decision: op.decision ?? null };
    }),
  };
}
