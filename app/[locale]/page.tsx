import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import Bookshelf from "@/components/Bookshelf";
import { getViewer } from "@/lib/viewer";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: "Home" });
  const viewer = await getViewer();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-center font-serif text-3xl">Martyrologium Romanum</h1>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
        {t("lead")}
      </p>
      <Bookshelf signedIn={viewer.signedIn} />
    </main>
  );
}
