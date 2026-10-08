import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import ApiReference from "@/components/ApiReference";

export const metadata = {
  title: "API reference · Roman Martyrology",
  description: "The Roman Martyrology API: its endpoints, parameters and responses, with requests to try.",
};

export default async function ScalarPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return <ApiReference />;
}
