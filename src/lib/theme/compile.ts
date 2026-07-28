import type { ThemeToken } from "./schema";
import { themeTokenSchema } from "./schema";

/**
 * Compiles a ThemeToken into a flat map of CSS custom properties. This is
 * the only place a ThemeToken's values become strings that touch CSS —
 * every component downstream reads `var(--cairn-*)` (via Tailwind's
 * `@theme inline` in globals.css), never the token object directly.
 */
export function compileThemeToCssVariables(
  rawToken: ThemeToken,
): Record<string, string> {
  const token = themeTokenSchema.parse(rawToken);

  return {
    "--cairn-color-bg": token.colors.bg,
    "--cairn-color-surface": token.colors.surface,
    "--cairn-color-surface-alt": token.colors.surfaceAlt,
    "--cairn-color-text": token.colors.text,
    "--cairn-color-text-muted": token.colors.textMuted,
    "--cairn-color-accent": token.colors.accent,
    "--cairn-color-accent-muted": token.colors.accentMuted,
    "--cairn-color-border": token.colors.border,
    "--cairn-color-success": token.colors.success,
    "--cairn-color-warning": token.colors.warning,

    // Font *names* (token.typography.displayFont etc.) select which
    // next/font loader layout.tsx statically renders — they aren't emitted
    // as CSS here. The actual font-family variables come from next/font
    // (--font-display-family etc., set as classNames on <html>) so fonts
    // stay self-hosted and optimized. See globals.css.
    "--cairn-type-scale": String(token.typography.scale),
    "--cairn-font-size-base": `${token.typography.baseSize}px`,
    "--cairn-line-height": String(token.typography.lineHeight),
    "--cairn-letter-spacing": token.typography.letterSpacing,
    "--cairn-measure": token.typography.measure,

    "--cairn-radius": token.geometry.radius,
    "--cairn-border-width": token.geometry.borderWidth,
    "--cairn-block-spacing": token.geometry.blockSpacing,
    "--cairn-page-padding": token.geometry.pagePadding,

    "--cairn-motion-duration": token.motion.enabled ? token.motion.duration : "0ms",
    "--cairn-motion-easing": token.motion.easing,

    "--cairn-sidebar-width": token.chrome.sidebarWidth,
    "--cairn-page-width": token.chrome.pageWidth,
  };
}
