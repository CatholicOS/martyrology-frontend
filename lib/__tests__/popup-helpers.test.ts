import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import es from "@/messages/es.json";
import pt from "@/messages/pt.json";
import type { Locale } from "@/i18n/routing";
import { popupPosition } from "@/lib/popup-position";
import { centuryOrdinal, formatWikidataDate, lifeYears, type MarkupT } from "@/lib/life-years";
import type { WikidataDate } from "@/lib/entities";
import { commonsPage, commonsThumb, wikidataUrl, wikipediaUrl } from "@/lib/wikimedia";
import { inLanguage } from "@/lib/mention-labels";

const vp = { width: 800, height: 600 };
const size = { width: 288, height: 200 };
const box = (top: number, left: number) => ({ top, bottom: top + 20, left, right: left + 60 });

describe("popupPosition", () => {
  it("sets the popup below its mention, at its left edge", () => {
    expect(popupPosition(box(100, 50), size, vp)).toEqual({ top: 126, left: 50, placement: "below" });
  });
  it("flips above a mention near the bottom of the window", () => {
    expect(popupPosition(box(500, 50), size, vp)).toEqual({ top: 294, left: 50, placement: "above" });
  });
  it("shifts left to stay in the window", () => {
    expect(popupPosition(box(100, 700), size, vp).left).toBe(800 - 288 - 8);
  });
  it("stays below when it fits neither way and there is more room below", () => {
    expect(popupPosition(box(40, 50), { width: 288, height: 700 }, vp).placement).toBe("below");
  });
});

describe("dates", () => {
  const tr = (locale: Locale, messages: typeof en) =>
    createTranslator({ locale, messages, namespace: "Markup" }) as unknown as MarkupT;
  const t = tr("en", en);
  const ti = tr("it", it_);
  const tf = tr("fr", fr);
  const td = tr("de", de);
  const te = tr("es", es);
  const tp = tr("pt", pt);
  const d = (year: number, precision: WikidataDate["precision"] = "year", circa = false) =>
    ({ year, precision, circa }) satisfies WikidataDate;

  it("writes a year as it is", () => {
    expect(formatWikidataDate(t, "en", d(329))).toBe("329");
    expect(formatWikidataDate(t, "en", d(1900))).toBe("1900");
  });

  it("marks a circa date in each language", () => {
    expect(formatWikidataDate(t, "en", d(329, "year", true))).toBe("c. 329");
    expect(formatWikidataDate(ti, "it", d(329, "year", true))).toBe("ca. 329");
    expect(formatWikidataDate(td, "de", d(329, "year", true))).toBe("ca. 329");
  });

  it("writes a decade from any year in it", () => {
    expect(formatWikidataDate(t, "en", d(325, "decade"))).toBe("320s");
    expect(formatWikidataDate(ti, "it", d(1920, "decade"))).toBe("anni 1920");
    expect(formatWikidataDate(td, "de", d(320, "decade"))).toBe("320er Jahre");
    expect(formatWikidataDate(tp, "pt", d(1225, "decade"))).toBe("década de 1220");
  });

  it("numbers a century in each language", () => {
    expect(centuryOrdinal(4, "en")).toBe("4th");
    expect(centuryOrdinal(21, "en")).toBe("21st");
    expect(centuryOrdinal(12, "en")).toBe("12th");
    expect(centuryOrdinal(13, "en")).toBe("13th");
    expect(centuryOrdinal(4, "it")).toBe("IV");
    expect(centuryOrdinal(13, "es")).toBe("XIII");
    expect(centuryOrdinal(13, "pt")).toBe("XIII");
    expect(centuryOrdinal(4, "de")).toBe("4");
    expect(centuryOrdinal(1, "fr")).toBe("Ier");
    expect(centuryOrdinal(4, "fr")).toBe("IVe");
    expect(centuryOrdinal(13, "fr")).toBe("XIIIe");
  });

  it("writes a century from any year in it, in each language", () => {
    expect(formatWikidataDate(t, "en", d(400, "century"))).toBe("4th century");
    expect(formatWikidataDate(t, "en", d(301, "century"))).toBe("4th century");
    expect(formatWikidataDate(t, "en", d(1201, "century"))).toBe("13th century");
    expect(formatWikidataDate(ti, "it", d(350, "century"))).toBe("IV secolo");
    expect(formatWikidataDate(tf, "fr", d(350, "century"))).toBe("IVe siècle");
    expect(formatWikidataDate(td, "de", d(350, "century"))).toBe("4. Jahrhundert");
    expect(formatWikidataDate(te, "es", d(350, "century"))).toBe("siglo IV");
    expect(formatWikidataDate(tp, "pt", d(350, "century"))).toBe("século IV");
  });

  it("writes a date before Christ, whatever its precision, circa outermost", () => {
    expect(formatWikidataDate(t, "en", d(-10))).toBe("10 BC");
    expect(formatWikidataDate(t, "en", d(-150, "century"))).toBe("2nd century BC");
    expect(formatWikidataDate(t, "en", d(-10, "year", true))).toBe("c. 10 BC");
    expect(formatWikidataDate(ti, "it", d(-10))).toBe("10 a.C.");
  });

  it("writes the life span with whichever dates are known", () => {
    expect(lifeYears(t, "en", d(329, "year", true), d(379))).toBe("c. 329 – 379");
    expect(lifeYears(t, "en", null, d(258))).toBe("d. 258");
    expect(lifeYears(t, "en", d(1900), null)).toBe("b. 1900");
    expect(lifeYears(t, "en", null, null)).toBeNull();
    expect(lifeYears(ti, "it", null, d(258))).toBe("m. 258");
  });

  it("writes a one-sided life span in the other languages", () => {
    expect(lifeYears(tf, "fr", null, d(258))).toBe("† 258");
    expect(lifeYears(td, "de", d(1226, "year", true), null)).toBe("* ca. 1226");
    expect(lifeYears(te, "es", d(1250, "century"), null)).toBe("n. siglo XIII");
    expect(lifeYears(tp, "pt", null, d(1225, "decade"))).toBe("m. década de 1220");
  });
});

describe("wikimedia", () => {
  it("builds the Commons, Wikipedia and Wikidata URLs", () => {
    expect(commonsThumb("Basil of Caesarea.jpg", 96)).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Basil_of_Caesarea.jpg?width=96");
    expect(commonsPage("Basil of Caesarea.jpg")).toBe("https://commons.wikimedia.org/wiki/File:Basil_of_Caesarea.jpg");
    expect(wikipediaUrl("it", "Basilio di Cesarea")).toBe("https://it.wikipedia.org/wiki/Basilio_di_Cesarea");
    expect(wikidataUrl("Q19546")).toBe("https://www.wikidata.org/wiki/Q19546");
  });

  it("percent-encodes characters that are not URL-safe in a title", () => {
    expect(commonsThumb("Who? #1 saint.jpg", 96)).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Who%3F_%231_saint.jpg?width=96");
    expect(commonsPage("Who? #1 saint.jpg")).toBe("https://commons.wikimedia.org/wiki/File:Who%3F_%231_saint.jpg");
    expect(wikipediaUrl("en", "What? Why#")).toBe("https://en.wikipedia.org/wiki/What%3F_Why%23");
  });
});

describe("inLanguage", () => {
  it("takes the interface language, else English, else the fallback, saying which", () => {
    expect(inLanguage({ it: "Roma", en: "Rome" }, "it", "Romæ", "la")).toEqual({ text: "Roma", lang: "it" });
    expect(inLanguage({ en: "Rome" }, "de", "Romæ", "la")).toEqual({ text: "Rome", lang: "en" });
    expect(inLanguage({}, "de", "Basilius", "la")).toEqual({ text: "Basilius", lang: "la" });
    expect(inLanguage(undefined, "de", null, null)).toBeNull();
  });
});
