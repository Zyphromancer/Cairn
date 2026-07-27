import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// This sandbox ships a pre-installed Chromium at a fixed path to avoid
// re-downloading it; CI and other environments don't have that path, so
// fall back to Playwright's own resolution (its downloaded browsers).
const sandboxChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
