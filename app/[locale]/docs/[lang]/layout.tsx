import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { DocsNav } from "@/components/docs/DocsNav";
import styles from "@/components/docs/docs.module.css";
import { DOC_LANGS, isDocLang } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LANGS.map((lang) => ({ lang }));
}

export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string; lang: string }> }) {
  const { locale, lang } = await params;
  setRequestLocale(locale as Locale);
  if (!isDocLang(lang)) notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:flex-row sm:gap-10">
      <DocsNav lang={lang} />
      <article lang={lang} className={`${styles.article} min-w-0 flex-1`}>
        {children}
      </article>
    </div>
  );
}
