// The Martyrology's calendar: every year has a 29 February page, and the book
// turns over from 31 December to 1 January. Months and days are 1-based.

export type Day = { mm: number; dd: number };
export type Lang = "la" | "it" | "en";

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MONTHS: Record<Lang, string[]> = {
  // Genitive, as printed in day headings ("2 Ianuarii").
  la: ["Ianuarii", "Februarii", "Martii", "Aprilis", "Maii", "Iunii",
       "Iulii", "Augusti", "Septembris", "Octobris", "Novembris", "Decembris"],
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
       "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
};

export function daysInMonth(mm: number): number {
  return MONTH_DAYS[mm - 1];
}

/** The reader's URL parts, which must be exactly two digits each and a real page. */
export function parseDay(mm: string, dd: string): Day | null {
  if (!/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) return null;
  const m = Number(mm);
  const d = Number(dd);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(m)) return null;
  return { mm: m, dd: d };
}

export function nextDay({ mm, dd }: Day): Day {
  if (dd < daysInMonth(mm)) return { mm, dd: dd + 1 };
  return mm === 12 ? { mm: 1, dd: 1 } : { mm: mm + 1, dd: 1 };
}

export function prevDay({ mm, dd }: Day): Day {
  if (dd > 1) return { mm, dd: dd - 1 };
  return mm === 1 ? { mm: 12, dd: 31 } : { mm: mm - 1, dd: daysInMonth(mm - 1) };
}

export function todayLocal(now: Date = new Date()): Day {
  return { mm: now.getMonth() + 1, dd: now.getDate() };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dayPath(edition: string, d: Day, withEdition?: string | null): string {
  const path = `/read/${encodeURIComponent(edition)}/${pad2(d.mm)}/${pad2(d.dd)}`;
  return withEdition ? `${path}?with=${encodeURIComponent(withEdition)}` : path;
}

export function monthName(mm: number, lang: Lang): string {
  return MONTHS[lang][mm - 1];
}

export function dateHeading(d: Day, lang: Lang): string {
  return `${d.dd} ${monthName(d.mm, lang)}`;
}
