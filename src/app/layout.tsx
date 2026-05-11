import type { Metadata } from "next";
import { Outfit, Inter, DM_Serif_Display, DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { AppwriteProvider } from "@/components/providers/AppwriteProvider";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MergeShip — Open Source, Leveled Up",
  description: "The platform that trains contributors to be ready before they submit, and gives maintainers a smart command center.",
  keywords: "open source, contributors, maintainers, GitHub, issues, pull requests",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${outfit.variable} ${inter.variable} ${dmSerifDisplay.variable} ${dmMono.variable} ${dmSans.variable}`}>
      <body className="bg-dark-900 text-white antialiased">
        <AppwriteProvider>
          {children}
        </AppwriteProvider>
      </body>
    </html>
  );
}
