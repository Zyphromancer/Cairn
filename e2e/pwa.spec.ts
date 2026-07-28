import { test, expect } from "@playwright/test";
import { cairnDefaultTheme } from "../src/lib/theme/presets/cairn-default";

// Verifies the machine-checkable PWA install criteria: a valid linked
// manifest with 192/512 icons + standalone display, and a service
// worker that registers, activates, and caches the app shell. The
// literal browser install prompt (Chrome UI, iPad Add to Home Screen)
// can't fire in headless automation and needs a manual check on the
// deployed HTTPS origin.

test("manifest is served, linked, and satisfies install criteria", async ({ page }) => {
  await page.goto("/login");

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();

  const res = await page.request.get(manifestHref!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();

  expect(manifest.name).toBe("Cairn");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe(cairnDefaultTheme.colors.bg);
  expect(manifest.background_color).toBe(cairnDefaultTheme.colors.bg);
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");

  for (const icon of manifest.icons) {
    const iconRes = await page.request.get(icon.src);
    expect(iconRes.ok()).toBe(true);
    expect(iconRes.headers()["content-type"]).toContain("image/png");
  }
});

test("service worker registers, activates, and caches the shell", async ({ page }) => {
  await page.goto("/login");

  // `ready` resolves once a worker is controlling the page, but its
  // `state` can still read "activating" for a brief moment after that —
  // poll rather than assert on the first read.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return registration.active?.state ?? null;
      }),
    )
    .toBe("activated");

  // The install handler pre-caches the shell; poll until the cache is
  // populated rather than assuming it finished before ready resolved.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const cache = await caches.open("cairn-shell-v1");
          const keys = await cache.keys();
          return keys.map((request) => new URL(request.url).pathname);
        }),
      { timeout: 10000 },
    )
    .toEqual(
      expect.arrayContaining(["/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"]),
    );
});
