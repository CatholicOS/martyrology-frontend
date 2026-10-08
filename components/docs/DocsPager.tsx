import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { docHref, neighbours } from "@/lib/docs";

/** The previous and next pages, at the foot of a docs page, titled in the interface language. */
export function DocsPager({ slug }: { slug: string }) {
  const t = useTranslations("Docs");
  const { prev, next } = neighbours(slug);
  if (!prev && !next) return null;
  return (
    <nav aria-label={`${t("prev")} / ${t("next")}`} className="mt-12 flex justify-between gap-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
      {prev ? (
        <Link href={docHref(prev.slug)} className="hover:underline">← {t("prev")}: {t(`pages.${prev.slug}.title`)}</Link>
      ) : <span />}
      {next && (
        <Link href={docHref(next.slug)} className="text-right hover:underline">{t("next")}: {t(`pages.${next.slug}.title`)} →</Link>
      )}
    </nav>
  );
}
