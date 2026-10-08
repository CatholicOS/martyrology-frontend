import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_INDEX, DOC_PAGES, DOC_PARTS, docHref, isDocLang } from "@/lib/docs";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDocLang(lang)) return {};
  return { title: `${DOC_INDEX[lang].title} — Roman Martyrology`, description: DOC_INDEX[lang].description };
}

export default async function DocsIndex({ params }: { params: Promise<{ locale: string; lang: string }> }) {
  const { locale, lang } = await params;
  setRequestLocale(locale as Locale);
  if (!isDocLang(lang)) notFound();
  const { default: Intro } = await import(`@/content/docs/${lang}/index.mdx`);
  return (
    <>
      <Intro components={docsComponents(lang)} />
      {DOC_PARTS.map(({ part, title }) => (
        <section key={part}>
          <h2>{title[lang]}</h2>
          <ul>
            {DOC_PAGES.filter((p) => p.part === part).map((p) => (
              <li key={p.slug}>
                <Link href={docHref(lang, p.slug)}>{p.text[lang].title}</Link> — {p.text[lang].description}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
