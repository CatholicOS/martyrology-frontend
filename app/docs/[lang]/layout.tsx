import { notFound } from "next/navigation";
import { DocsNav } from "@/components/docs/DocsNav";
import styles from "@/components/docs/docs.module.css";
import { DOC_LANGS, isDocLang } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LANGS.map((lang) => ({ lang }));
}

export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
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
