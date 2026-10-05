import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getDataVersions } from "@/lib/data-versions";

export const metadata = {
  title: "Roman Martyrology",
  description: "The editions of the Roman Martyrology, read day by day.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter versions={await getDataVersions()} />
      </body>
    </html>
  );
}
