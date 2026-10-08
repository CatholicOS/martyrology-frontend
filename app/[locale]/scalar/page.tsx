import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import ApiReference from "@/components/ApiReference";

async function titleFor(locale: string) {
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  return t("apiReferenceTitle", { book: t("bookTitle") });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  return { title: await titleFor(locale), description: t("apiReferenceDescription") };
}

export default async function ScalarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ApiReference locale={locale} title={await titleFor(locale)} />;
}
