import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className={`dark ${outfit.variable} ${inter.variable}`}>
      <body className="bg-dark-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
