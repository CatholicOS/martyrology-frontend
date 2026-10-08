import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { DraftNotice } from "@/components/docs/DraftNotice";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_PAGES, DOC_PARTS, REVIEWED_DOC_LANGS, docContentLang, docHref } from "@/lib/docs";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const d = await getTranslations({ locale: locale as Locale, namespace: "Docs" });
  return { title: t("titleWithBook", { title: d("index.title"), book: t("bookTitle") }), description: d("index.description") };
}

export default async function DocsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Docs" });
  const { default: Intro } = await import(`@/content/docs/${docContentLang(locale)}/index.mdx`);
  return (
    <>
      {!REVIEWED_DOC_LANGS.includes(locale) && <DraftNotice />}
      <Intro components={docsComponents} />
      {DOC_PARTS.map((part) => (
        <section key={part}>
          <h2>{t(`parts.${part}`)}</h2>
          <ul>
            {DOC_PAGES.filter((p) => p.part === part).map((p) => (
              <li key={p.slug}>
                <Link href={docHref(p.slug)}>{t(`pages.${p.slug}.title`)}</Link> — {t(`pages.${p.slug}.description`)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
