import { describe, it, expect } from "vitest";
import { LOCALES, LOCALE_NAMES, isLocale, routing } from "@/i18n/routing";

describe("routing", () => {
  it("has the six locales, English first and default, always prefixed, no next-intl cookie", () => {
    expect(LOCALES).toEqual(["en", "it", "fr", "de", "es", "pt"]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localePrefix).toBe("always");
    expect(routing.localeCookie).toBe(false);
  });
  it("names each language in itself", () => {
    expect(LOCALE_NAMES).toEqual({ en: "English", it: "Italiano", fr: "Français", de: "Deutsch", es: "Español", pt: "Português" });
  });
  it("recognizes only its locales", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("la")).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});
