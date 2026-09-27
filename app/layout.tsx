import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BuildWise",
  description:
    "Preliminary Pittsburgh site screening for small and mid-sized housing developers. Not legal, zoning, engineering, environmental, or financial advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <body className="font-sans antialiased">
        <a href="#analyze" className="skip-link bw-btn">
          Skip to analyze
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
