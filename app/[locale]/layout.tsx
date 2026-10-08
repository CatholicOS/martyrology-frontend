import localFont from "next/font/local";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getDataVersions } from "@/lib/data-versions";
import { routing } from "@/i18n/routing";

// The editions' text face: Junicode covers what they print (carons, combining marks, polytonic
// Greek, medieval abbreviations) where Georgia does not. See app/fonts/junicode/README.md.
const textFont = localFont({
  src: [
    { path: "../fonts/junicode/Junicode-Roman.woff2", weight: "400", style: "normal" },
    { path: "../fonts/junicode/Junicode-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-text",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("bookTitle"), description: t("siteDescription") };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={textFont.variable}>
      <body className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <NextIntlClientProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter versions={await getDataVersions()} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
