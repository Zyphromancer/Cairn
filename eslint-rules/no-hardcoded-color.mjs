// Local ESLint rule: forbid hardcoded color literals (hex, rgb(), hsl())
// in application code. Colors live only in ThemeToken presets
// (src/lib/theme/presets/**) and flow out as CSS custom properties — see
// src/lib/theme/compile.ts. This is the enforcement side of that rule.

const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;
const FUNC_COLOR = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/i;

function containsColor(value) {
  return typeof value === "string" && (HEX_COLOR.test(value) || FUNC_COLOR.test(value));
}

const noHardcodedColor = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded color literals; use ThemeToken CSS variables instead.",
    },
    schema: [],
    messages: {
      hardcoded:
        "Hardcoded color literal found ('{{value}}'). Add it to a ThemeToken preset (src/lib/theme/presets) and reference the resulting CSS variable / Tailwind token instead.",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (containsColor(node.value)) {
          context.report({ node, messageId: "hardcoded", data: { value: String(node.value) } });
        }
      },
      TemplateElement(node) {
        const raw = node.value?.raw;
        if (containsColor(raw)) {
          context.report({ node, messageId: "hardcoded", data: { value: raw } });
        }
      },
    };
  },
};

const plugin = {
  rules: {
    "no-hardcoded-color": noHardcodedColor,
  },
};

export default plugin;
