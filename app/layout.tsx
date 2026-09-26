import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildWise",
  description:
    "Preliminary Pittsburgh site screening for small and mid-sized housing developers. Not legal, zoning, engineering, environmental, or financial advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900">{children}</body>
    </html>
  );
}
