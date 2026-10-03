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

export interface EditionPlacement {
  day_printed: string;
  entry: number | null;
  asterisk: boolean;
  unnumbered: boolean;
  text: string | null;
  footnotes?: Footnote[];
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
}

export interface DayContentOut {
  titulus: string | null;
  elogia: ElogiumOut[];
  conclusio: string | null;
}

export type AccessMap = Record<string, { can_read_texts: boolean }>;

export interface AccessOut {
  editions: AccessMap;
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
