import { notFound } from "next/navigation";
import { DocsPager } from "@/components/docs/DocsPager";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_LANGS, DOC_PAGES, findPage, isDocLang } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LANGS.flatMap((lang) => DOC_PAGES.map((p) => ({ lang, page: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; page: string }> }) {
  const { lang, page } = await params;
  const p = findPage(page);
  if (!isDocLang(lang) || !p) return {};
  return { title: `${p.text[lang].title} — Roman Martyrology`, description: p.text[lang].description };
}

export default async function DocPage({ params }: { params: Promise<{ lang: string; page: string }> }) {
  const { lang, page } = await params;
  if (!isDocLang(lang) || !findPage(page)) notFound();
  const { default: Content } = await import(`@/content/docs/${lang}/${page}.mdx`);
  return (
    <>
      <Content components={docsComponents(lang)} />
      <DocsPager lang={lang} slug={page} />
    </>
  );
}
