import type { ThemeToken } from "../schema";

// The one preset that ships in Phase 1. Phase 10 adds the remaining seven
// (high-contrast, low-stimulation, paper, etc.) plus redesign-by-prompt —
// this file's shape is what those will slot into.
export const cairnDefaultTheme: ThemeToken = {
  name: "Cairn",
  colors: {
    bg: "#0a0908",
    surface: "#14120f",
    surfaceAlt: "#1c1916",
    text: "#ede6d8",
    textMuted: "#a39c8e",
    accent: "#b8923b",
    accentMuted: "#8a6f3f",
    border: "#2a2621",
    success: "#6e8f5c",
    warning: "#c97c3d",
  },
  typography: {
    displayFont: "Space Grotesk",
    bodyFont: "Source Serif 4",
    monoFont: "JetBrains Mono",
    scale: 1.2,
    baseSize: 16,
    lineHeight: 1.6,
    letterSpacing: "0em",
    measure: "68ch",
  },
  geometry: {
    radius: "4px",
    borderWidth: "1px",
    density: "comfortable",
    blockSpacing: "0.5rem",
    pagePadding: "3rem",
  },
  motion: {
    duration: "150ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    enabled: true,
  },
  chrome: {
    sidebarPosition: "left",
    sidebarWidth: "280px",
    toolbarStyle: "minimal",
    blockHandles: "hover",
    pageWidth: "760px",
    cardStyle: "flat",
  },
};
