import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthStatus } from "@/components/AuthStatus";
import { LocalePicker } from "@/components/LocalePicker";
import { NavMenu } from "@/components/NavMenu";
import { getViewer } from "@/lib/viewer";

export async function SiteHeader() {
  const viewer = await getViewer();
  const t = await getTranslations("Header");
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
        <Link href="/" className="font-serif text-lg font-semibold">
          {t("brand")}
        </Link>
        <NavMenu>
          <Link href="/docs/en">{t("docs")}</Link>
          <Link href="/map">{t("map")}</Link>
          <Link href="/scalar">{t("api")}</Link>
          {viewer.curator && <Link href="/compare">{t("compare")}</Link>}
          {viewer.curator && <Link href="/review">{t("review")}</Link>}
          <LocalePicker />
          <AuthStatus />
        </NavMenu>
      </div>
    </header>
  );
}
