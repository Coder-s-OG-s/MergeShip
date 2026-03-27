import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-dark-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
