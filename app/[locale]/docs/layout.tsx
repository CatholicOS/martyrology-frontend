import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { DocsNav } from "@/components/docs/DocsNav";
import styles from "@/components/docs/docs.module.css";
import { docContentLang } from "@/lib/docs";

/** The docs' frame: the sidebar in the interface language, the article in its content's language (English where none is written yet). */
export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:flex-row sm:gap-10">
      <DocsNav />
      <article lang={docContentLang(locale as Locale)} className={`${styles.article} min-w-0 flex-1`}>
        {children}
      </article>
    </div>
  );
}
