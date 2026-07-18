import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE = "https://kansascommercialroofers.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Kansas Commercial Roofers | Industrial & Commercial Roofing Statewide",
  description:
    "Kansas Commercial Roofers installs, repairs, and maintains commercial roof systems across Kansas \u2014 TPO, PVC, EPDM, metal, coatings and more. Free storm report & inspection. 24/7 emergency service.",
  keywords: [
    "commercial roofing Kansas",
    "industrial roofing",
    "TPO roofing",
    "flat roof repair",
    "commercial roof inspection",
    "Wichita commercial roofer",
  ],
  openGraph: {
    title: "Kansas Commercial Roofers | Industrial & Commercial Roofing",
    description:
      "Relentless in our pursuit to build the best tomorrow. Commercial roof systems installed, repaired, and maintained across Kansas.",
    url: SITE,
    siteName: "Kansas Commercial Roofers",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kansas Commercial Roofers",
    description:
      "Industrial & commercial roofing across Kansas. Free storm report & inspection.",
  },
  alternates: { canonical: SITE },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RoofingContractor",
  name: "Kansas Commercial Roofers",
  description:
    "Industrial and commercial roofing contractor serving Kansas. Installation, repair, and maintenance of TPO, PVC, EPDM, metal, and coating roof systems.",
  url: SITE,
  telephone: "+1-316-555-0142",
  areaServed: { "@type": "State", name: "Kansas" },
  address: {
    "@type": "PostalAddress",
    addressRegion: "KS",
    addressCountry: "US",
  },
  priceRange: "$$",
  slogan: "Relentless in our pursuit to build the best tomorrow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
