import { z } from "zod";

// The single source of truth for all visual design in Cairn. Nothing in the
// app should reference a raw color, font, or spacing value outside of a
// ThemeToken — everything compiles down to CSS custom properties (see
// compile.ts) and Tailwind reads only those variables (see globals.css).
//
// This schema is deliberately the full shape described by the Phase 10
// (adaptive theming) spec even though only one preset ships today, because
// retrofitting the indirection later would mean touching every component.

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #0a0908");

export const colorTokens = z.object({
  bg: hexColor,
  surface: hexColor,
  surfaceAlt: hexColor,
  text: hexColor,
  textMuted: hexColor,
  accent: hexColor,
  accentMuted: hexColor,
  border: hexColor,
  success: hexColor,
  warning: hexColor,
});

export const typographyTokens = z.object({
  displayFont: z.string(),
  bodyFont: z.string(),
  monoFont: z.string(),
  scale: z.number().positive(),
  baseSize: z.number().positive(),
  lineHeight: z.number().positive(),
  letterSpacing: z.string(),
  measure: z.string(),
});

export const geometryTokens = z.object({
  radius: z.string(),
  borderWidth: z.string(),
  density: z.enum(["compact", "comfortable", "spacious"]),
  blockSpacing: z.string(),
  pagePadding: z.string(),
});

export const motionTokens = z.object({
  duration: z.string(),
  easing: z.string(),
  enabled: z.boolean(),
});

export const chromeTokens = z.object({
  sidebarPosition: z.enum(["left", "right"]),
  sidebarWidth: z.string(),
  toolbarStyle: z.enum(["minimal", "standard"]),
  blockHandles: z.enum(["hover", "always", "never"]),
  pageWidth: z.string(),
  cardStyle: z.enum(["flat", "outlined"]),
});

export const themeTokenSchema = z.object({
  name: z.string(),
  colors: colorTokens,
  typography: typographyTokens,
  geometry: geometryTokens,
  motion: motionTokens,
  chrome: chromeTokens,
});

export type ThemeToken = z.infer<typeof themeTokenSchema>;
