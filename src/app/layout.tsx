import type { Metadata } from "next";
import { Space_Grotesk, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import type { CSSProperties } from "react";
import "./globals.css";
import { compileThemeToCssVariables } from "@/lib/theme/compile";
import { cairnDefaultTheme } from "@/lib/theme/presets/cairn-default";

const displayFont = Space_Grotesk({
  variable: "--font-display-family",
  subsets: ["latin"],
});

const bodyFont = Source_Serif_4({
  variable: "--font-body-family",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono-family",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cairn",
  description: "A calm, adaptable workspace for notes, docs, and tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeVars = compileThemeToCssVariables(cairnDefaultTheme);

  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
      style={themeVars as CSSProperties}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
