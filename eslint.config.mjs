import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import cairnLocal from "./eslint-rules/no-hardcoded-color.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { cairn: cairnLocal },
    rules: {
      "cairn/no-hardcoded-color": "error",
    },
  },
  {
    // The ThemeToken system is the one place color literals are allowed —
    // it's the source they get compiled from.
    files: ["src/lib/theme/presets/**", "src/lib/theme/schema.ts"],
    rules: {
      "cairn/no-hardcoded-color": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
