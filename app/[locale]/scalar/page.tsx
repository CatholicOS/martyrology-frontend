import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import ApiReference from "@/components/ApiReference";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "Metadata" });
  return { title: t("apiReferenceTitle", { book: t("bookTitle") }), description: t("apiReferenceDescription") };
}

export default async function ScalarPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return <ApiReference />;
}
