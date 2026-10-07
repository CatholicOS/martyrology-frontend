import localFont from "next/font/local";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getDataVersions } from "@/lib/data-versions";

// The editions' text face: Junicode covers what they print (carons, combining marks, polytonic
// Greek, medieval abbreviations) where Georgia does not. See app/fonts/junicode/README.md.
const textFont = localFont({
  src: [
    { path: "./fonts/junicode/Junicode-Roman.woff2", weight: "400", style: "normal" },
    { path: "./fonts/junicode/Junicode-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-text",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata = {
  title: "Roman Martyrology",
  description: "The editions of the Roman Martyrology, read day by day.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={textFont.variable}>
      <body className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter versions={await getDataVersions()} />
      </body>
    </html>
  );
}
