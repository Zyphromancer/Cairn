import { expect, type Page } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";

async function getLatestMagicLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const data = await res.json();
    const message = data.messages?.find((m: { To: { Address: string }[] }) =>
      m.To.some((to) => to.Address === email),
    );
    if (message) {
      const fullRes = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      const full = await fullRes.json();
      const html: string = full.HTML ?? full.Text ?? "";
      const match = html.match(/href="([^"]+)"/);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No magic link email arrived for ${email}`);
}

export async function signInAndCreateWorkspace(page: Page, workspaceName: string) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  const link = await getLatestMagicLink(email);
  await page.goto(link);
  // The verify → callback chain sets the session cookies, but the
  // proxy's getUser() call can transiently fail on a loaded CI runner
  // (a network blip to GoTrue reads as "no user"), bouncing the very
  // first authenticated navigation to /login even though the cookies
  // are already in the jar. Re-visiting home recovers. This can't mask
  // a genuinely failed verify: that lands on /auth/auth-code-error with
  // no session, so the form never appears and the fill below still
  // fails loudly.
  for (let attempt = 0; attempt < 3; attempt++) {
    const formVisible = await page
      .getByPlaceholder("Acme Inc")
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (formVisible) break;
    await page.goto("/");
  }
  await page.getByPlaceholder("Acme Inc").fill(workspaceName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/w\//);
  const slug = new URL(page.url()).pathname.split("/")[2];
  return { email, slug };
}

/** Navigates to a fresh page inside a fresh workspace, ready for block editing. */
export async function openFreshPage(page: Page, workspaceName: string) {
  await signInAndCreateWorkspace(page, workspaceName);
  await page.getByRole("button", { name: "New page in Workspace" }).click();
  await expect(page).toHaveURL(/\/p\//);
}
