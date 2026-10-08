import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { DocsPager } from "@/components/docs/DocsPager";
import { DraftNotice } from "@/components/docs/DraftNotice";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_PAGES, REVIEWED_DOC_LANGS, docContentLang, findPage } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DOC_PAGES.map((p) => ({ locale, page: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await params;
  const p = findPage(page);
  if (!p) return {};
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const d = await getTranslations({ locale: locale as Locale, namespace: "Docs" });
  return { title: t("titleWithBook", { title: d(`pages.${p.slug}.title`), book: t("bookTitle") }), description: d(`pages.${p.slug}.description`) };
}

export default async function DocPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale: l, page } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  if (!findPage(page)) notFound();
  const { default: Content } = await import(`@/content/docs/${docContentLang(locale)}/${page}.mdx`);
  return (
    <>
      {!REVIEWED_DOC_LANGS.includes(locale) && <DraftNotice />}
      <Content components={docsComponents} />
      <DocsPager slug={page} />
    </>
  );
}
