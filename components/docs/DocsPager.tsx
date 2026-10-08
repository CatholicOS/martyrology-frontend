import Link from "next/link";
import { docHref, neighbours, type DocLang } from "@/lib/docs";

const LABELS: Record<DocLang, { prev: string; next: string }> = {
  en: { prev: "Previous", next: "Next" },
  it: { prev: "Precedente", next: "Successivo" },
};

/** The previous and next pages, at the foot of a docs page. */
export function DocsPager({ lang, slug }: { lang: DocLang; slug: string }) {
  const { prev, next } = neighbours(slug);
  if (!prev && !next) return null;
  return (
    <nav aria-label={`${LABELS[lang].prev} / ${LABELS[lang].next}`} className="mt-12 flex justify-between gap-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
      {prev ? (
        <Link href={docHref(lang, prev.slug)} className="hover:underline">← {LABELS[lang].prev}: {prev.text[lang].title}</Link>
      ) : <span />}
      {next && (
        <Link href={docHref(lang, next.slug)} className="text-right hover:underline">{LABELS[lang].next}: {next.text[lang].title} →</Link>
      )}
    </nav>
  );
}
