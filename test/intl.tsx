import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import es from "@/messages/es.json";
import pt from "@/messages/pt.json";
import type { Locale } from "@/i18n/routing";

export const MESSAGES = { en, it, fr, de, es, pt } as const;

/** Testing Library's render inside the locale's messages (English by default). */
export function renderWithIntl(ui: ReactElement, { locale = "en", ...options }: { locale?: Locale } & RenderOptions = {}) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">{children}</NextIntlClientProvider>
  );
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}
export const render = renderWithIntl;
export { screen, fireEvent, waitFor, within, act, cleanup } from "@testing-library/react";
