export type Locale = "la" | "it" | "en";

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

export interface EditionPlacement {
  day_printed: string;
  entry: number | null;
  asterisk: boolean;
  unnumbered: boolean;
  text: string | null;
}

export interface EulogyOut {
  id: string;
  subject: Record<string, string>;
  anchor_day: string;
  deprecated: boolean;
  editions: Record<string, EditionPlacement>;
}

export interface ElogiumOut {
  id: string | null;
  entry: number | null;
  asterisk: boolean;
  unnumbered: boolean;
  anchor_day: string;
  text: string | null;
}

export interface DayContentOut {
  titulus: string | null;
  elogia: ElogiumOut[];
  conclusio: string | null;
}
