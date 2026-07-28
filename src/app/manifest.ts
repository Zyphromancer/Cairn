import type { MetadataRoute } from "next";
import { cairnDefaultTheme } from "@/lib/theme/presets/cairn-default";

// Served at /manifest.webmanifest and auto-linked by Next. Colors come
// from the default theme preset rather than literals — the manifest is
// static at build time, so it always reflects the shipped default theme
// (a runtime theme switch, Phase 10, can't retint an installed icon
// anyway).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cairn",
    short_name: "Cairn",
    description: "A calm, adaptable workspace for notes, docs, and tasks.",
    start_url: "/",
    display: "standalone",
    background_color: cairnDefaultTheme.colors.bg,
    theme_color: cairnDefaultTheme.colors.bg,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
