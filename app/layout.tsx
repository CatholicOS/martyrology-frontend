import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Roman Martyrology",
  description: "The editions of the Roman Martyrology, read day by day.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
