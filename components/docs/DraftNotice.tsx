import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/docs/docs.module.css";

/** At the head of a docs page in a language no native speaker has reviewed yet: a call to help review it. */
export function DraftNotice() {
  const t = useTranslations("Docs");
  return (
    <div className={`${styles.banner} mb-6`} role="note">
      {t.rich("draftNotice", { link: (c) => <Link href="/docs/contributing" className="underline">{c}</Link> })}
    </div>
  );
}
