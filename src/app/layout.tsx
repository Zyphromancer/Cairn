import type { Metadata } from "next";
import { Space_Grotesk, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import type { CSSProperties } from "react";
import "./globals.css";
import { compileThemeToCssVariables } from "@/lib/theme/compile";
import { cairnDefaultTheme } from "@/lib/theme/presets/cairn-default";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

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
  // Safari doesn't fully honor the manifest's display: standalone —
  // these emit the apple-mobile-web-app-* meta tags that make Add to
  // Home Screen launch without browser chrome on iPhone/iPad.
  appleWebApp: {
    capable: true,
    title: "Cairn",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: cairnDefaultTheme.colors.bg,
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
      <body className="min-h-full flex flex-col bg-bg text-text">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
