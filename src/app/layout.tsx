import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Brand type (guide p.9): Filson Pro primary, Inter secondary.
// Filson is a paid font; until a web licence is bought, Outfit (free, geometric) stands in
// for headings. See README → "Brand fonts" to switch to Filson.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Ship Ease Hub · Modern Logistics & Shipping Solution", template: "%s · Ship Ease Hub" },
  description: "Ship from Nigeria to the world, and shop from the USA, UK and China to Nigeria. Movement made easy.",
  metadataBase: new URL(process.env.APP_URL ?? "https://www.shipeasehub.com"),
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Ship Ease Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#00002E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
