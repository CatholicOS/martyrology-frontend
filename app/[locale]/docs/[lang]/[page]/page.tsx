import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { DocsPager } from "@/components/docs/DocsPager";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_LANGS, DOC_PAGES, findPage, isDocLang } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LANGS.flatMap((lang) => DOC_PAGES.map((p) => ({ lang, page: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; lang: string; page: string }> }) {
  const { locale, lang, page } = await params;
  const p = findPage(page);
  if (!isDocLang(lang) || !p) return {};
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  return { title: t("titleWithBook", { title: p.text[lang].title, book: t("bookTitle") }), description: p.text[lang].description };
}

export default async function DocPage({ params }: { params: Promise<{ locale: string; lang: string; page: string }> }) {
  const { locale, lang, page } = await params;
  setRequestLocale(locale as Locale);
  if (!isDocLang(lang) || !findPage(page)) notFound();
  const { default: Content } = await import(`@/content/docs/${lang}/${page}.mdx`);
  return (
    <>
      <Content components={docsComponents(lang)} />
      <DocsPager lang={lang} slug={page} />
    </>
  );
}
