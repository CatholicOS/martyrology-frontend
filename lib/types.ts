export type Locale = "la" | "it" | "en";

/** The printed copy an edition's texts were taken from (the API's `source.json`). */
export interface EditionSource {
  title: string;
  imprint?: string | null;
  year?: number | null;
  rights?: string | null;
  isbn?: string | null;
  note?: string | null;
}

export interface EditionOut {
  edition_id: string;
  book: string;
  year: number;
  nature: string;
  scope: Record<string, unknown>;
  locale: string;
  promulgation: Record<string, unknown>;
  predecessor?: string | null;
  successor?: string | null;
  governance: { governing_body: string; type: string; nation?: string | null };
  availability: { status: string; note?: string | null };
  aligned?: boolean | null;
  source?: EditionSource | null;
}

export interface CatalogEntryOut {
  id: string;
  subject: string | null;
  anchor_day: string;
  deprecated: boolean;
  present?: boolean;
  day_printed?: string | null;
  entry?: number | null;
}

/** A footnote as the edition prints it under a eulogy (the API's `footnotes.json`). */
export interface Footnote {
  /** The printed mark: "1", "12", "*". */
  mark: string;
  /** The phrase the mark follows in the text; null when it couldn't be anchored. */
  after: string | null;
  text: string;
}

/**
 * A note the edition prints in the margin (the API's `marginalia.json`): `note` is the mark of the
 * footnote it stands beside, null when it stands beside the eulogy's own text.
 */
export interface MarginNote {
  text: string;
  note: string | null;
}

/**
 * A correction the edition itself prints in its errata (the API's `printed_errata.json`):
 * `printed` occurs once in the text; `replace` reads it as `corrected`, `add` adds `corrected`
 * after it (before it when `position` is "before": an addition that opens the eulogy), `delete`
 * drops it. `ref` is the printed page.line ("vbique": everywhere), `entry` the erratum as
 * printed. The text stays as printed.
 */
export interface Erratum {
  kind: "replace" | "add" | "delete";
  printed: string;
  corrected: string;
  ref: string;
  entry: string;
  /** Absent from APIs older than v0.14.2; "after" by default. */
  position?: "after" | "before";
}

/**
 * A person or place a eulogy names (crmedr's mentions, checked by the API against the text): where its words
 * are, `start`/`end` in UTF-16 code units (JavaScript string indices) of the text or of footnote n (counted
 * from 1 in the eulogy's footnotes), and the Wikidata item crmedr decided for it, null while undecided.
 * `name` is a person's nominative, the key crmedr files them by; the API always sends it, null for a place.
 */
export interface Mention {
  kind: "person" | "place";
  where: "text" | { footnote: number };
  start: number;
  end: number;
  form: string;
  qid: string | null;
  name: string | null;
}

export interface EditionPlacement {
  day_printed: string;
  entry: number | null;
  asterisk: boolean;
  unnumbered: boolean;
  text: string | null;
  footnotes?: Footnote[];
  marginalia?: MarginNote[];
  errata?: Erratum[];
}

export interface EulogyOut {
  id: string;
  subject: Record<string, string>;
  anchor_day: string;
  deprecated: boolean;
  editions: Record<string, EditionPlacement>;
  /** The same eulogy printed by another edition on another day (other IDs). */
  same_eulogy?: string[];
}

export interface ElogiumOut {
  id: string | null;
  entry: number | null;
  asterisk: boolean;
  unnumbered: boolean;
  anchor_day: string;
  text: string | null;
  footnotes?: Footnote[];
  /** Absent from APIs older than v0.13.0. */
  marginalia?: MarginNote[];
  /** Absent from APIs older than v0.14.0. */
  errata?: Erratum[];
  /** The persons and places it names; absent from APIs before they were served. */
  mentions?: Mention[];
}

/** A rubric the print sets among the eulogies: `after` is the eulogy it follows, null at the head of the day. */
export interface Rubrica {
  after: string | null;
  text: string;
}

/** One column of a day's lunar table: the letter of the Martyrology, its epact, the moon's age under it, and the
 * number the edition prints there when it misprints it. */
export interface LunaColumn {
  letter: string;
  epact: string;
  age: number;
  printed: number | null;
  /** Printed in red (the 2004 edition tells its two F apart by colour). */
  red?: boolean;
}

/** The moon announced under the day in `year` (Gregorian computus): the year's letter reads `column`. */
export interface LunaAnnouncement {
  year: number;
  golden_number: number;
  epact: string;
  letter: string;
  column: number;
  age: number;
  /** "Luna vigesima prima" */
  pronuntiatio: string;
}

/** The calendar apparatus printed with the day: the lunar table (31 columns, in printed order, set in `rows` of
 * that many), the margin's dominical letter and new-moon epacts (null when the edition prints no margin), and the
 * announcement in the edition's language (null before 1583). */
export interface Luna {
  rows?: number[];
  dominical_letter: string | null;
  epactae: string[] | null;
  tabula: LunaColumn[];
  annuntiatio: LunaAnnouncement | null;
}

export interface DayContentOut {
  titulus: string | null;
  elogia: ElogiumOut[];
  /** Absent from APIs older than v0.11.0. */
  rubricae?: Rubrica[];
  conclusio: string | null;
  /** Only for an edition that prints the lunar table; absent from APIs older than v0.15.0. */
  luna?: Luna | null;
}

export type AccessMap = Record<string, { can_read_texts: boolean }>;

export interface AccessOut {
  editions: AccessMap;
}

/** The month endpoint's response: its days by "DD"; `access` is "restricted-texts" when the caller is denied. */
export interface MonthOut {
  metadata: { edition: string; month: number; access?: string | null; access_info?: string | null };
  days: Record<string, DayContentOut>;
}

/** The day endpoint's full response; `access` is "restricted-texts" when the caller is denied. */
export interface DayOut extends DayContentOut {
  metadata: {
    edition: string;
    month: number;
    day: number | null;
    access?: string | null;
    access_info?: string | null;
  };
}
