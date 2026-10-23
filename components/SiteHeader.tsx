import Image from "next/image";
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
        <Link href="/" className="flex items-center gap-2 font-serif text-lg font-semibold">
          {/* The app icon's emblem (scripts/build-icons.mjs): decorative, so the link keeps the title as its name; an SVG,
              so served as is, never through the image optimizer. */}
          <Image src="/app-icons/emblem.svg" alt="" width={32} height={32} unoptimized priority className="h-8 w-8 shrink-0" />
          {t("brand")}
        </Link>
        <NavMenu>
          <Link href="/docs">{t("docs")}</Link>
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
