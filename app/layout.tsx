import type { Metadata } from "next";
import { Spectral } from "next/font/google";
import "./globals.css";

/**
 * One typeface across every role — hierarchy comes from size and weight,
 * never from a second family (docs/COSMOS-DESIGN.md).
 *
 * Cosmos's own face, cosmosOracle, is proprietary and unavailable. Spectral
 * is the substitute the spec recommends: an open transitional serif that
 * keeps the light, refined, slightly literary voice. Swapping it is a change
 * to this import and the --font-display token in globals.css.
 */
const display = Spectral({
  variable: "--font-cosmos",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kaialan",
    template: "%s - Kaialan",
  },
  description: "Selected work by Kaialan - product design, graphics, creatives.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
