import type { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { WikidataDate } from "@/lib/entities";

/** The translator of the `Markup` namespace. */
export type MarkupT = ReturnType<typeof useTranslations<"Markup">>;

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"],
  [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function roman(n: number): string {
  let out = "";
  for (const [v, r] of ROMAN) {
    for (; n >= v; n -= v) out += r;
  }
  return out;
}

const EN_ORDINAL: Record<string, string> = { one: "st", two: "nd", few: "rd" };

/**
 * A century's number as each language writes it in its message (Markup.century): "4th" in English, "4" in German
 * (the message adds the full stop), Roman numerals in the Romance languages, French with its ordinal suffix
 * ("Ier", "IVe").
 */
export function centuryOrdinal(n: number, locale: Locale): string {
  if (locale === "en") return `${n}${EN_ORDINAL[new Intl.PluralRules("en", { type: "ordinal" }).select(n)] ?? "th"}`;
  if (locale === "de") return String(n);
  if (locale === "fr") return n === 1 ? "Ier" : `${roman(n)}e`;
  return roman(n);
}

/**
 * One Wikidata date at the precision Wikidata gives it: "329", "320s", "4th century", in the interface language,
 * "BC" after a date before Christ and "c." around a circa one. A decade or century is found from any year in it.
 * Years are strings to the messages, so 1900 is never written "1,900".
 */
export function formatWikidataDate(t: MarkupT, locale: Locale, d: WikidataDate): string {
  const y = Math.abs(d.year);
  const base =
    d.precision === "century"
      ? t("century", { ordinal: centuryOrdinal(Math.floor((y - 1) / 100) + 1, locale) })
      : d.precision === "decade"
        ? t("decade", { decade: String(Math.floor(y / 10) * 10) })
        : String(y);
  const dated = d.year < 0 ? t("bc", { date: base }) : base;
  return d.circa ? t("circa", { date: dated }) : dated;
}

/** A person's life span for the popup, born – died with whichever Wikidata knows; null when it knows neither. */
export function lifeYears(t: MarkupT, locale: Locale, born: WikidataDate | null, died: WikidataDate | null): string | null {
  const b = born ? formatWikidataDate(t, locale, born) : null;
  const d = died ? formatWikidataDate(t, locale, died) : null;
  if (b && d) return t("lifeBoth", { born: b, died: d });
  if (d) return t("lifeDied", { died: d });
  if (b) return t("lifeBorn", { born: b });
  return null;
}
