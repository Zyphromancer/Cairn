import { test, expect } from "@playwright/test";

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

test("magic link sign-in reaches the authenticated home page", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByText("Check")).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Cairn")).toBeVisible();
  await expect(page.getByText("No workspaces yet")).toBeVisible();
});

test("creating a workspace adds the creator as owner", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  const link = await getLatestMagicLink(email);
  await page.goto(link);

  await page.getByPlaceholder("Acme Inc").fill("Test Workspace");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/w\/test-workspace-/);
  const slug = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`/w/${slug}/settings/members`);
  await expect(page.locator("select")).toHaveValue("owner");
  await expect(page.getByText(email).first()).toBeVisible();
});

test("signed-out users are redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("an owner can invite an existing user and change their role", async ({
  page,
  browser,
}) => {
  const ownerEmail = `e2e-owner-${Date.now()}@example.com`;
  const memberEmail = `e2e-member-${Date.now()}@example.com`;

  // Member signs in once first, in a separate browser context (own cookie
  // jar) so their profile exists without sharing a session with the owner.
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/login");
  await memberPage.getByPlaceholder("you@example.com").fill(memberEmail);
  await memberPage.getByRole("button", { name: "Send magic link" }).click();
  const memberLink = await getLatestMagicLink(memberEmail);
  await memberPage.goto(memberLink);
  await memberContext.close();

  // Owner signs in and creates a workspace.
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ownerEmail);
  await page.getByRole("button", { name: "Send magic link" }).click();
  const ownerLink = await getLatestMagicLink(ownerEmail);
  await page.goto(ownerLink);
  await page.getByPlaceholder("Acme Inc").fill("Invite Test Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/w\/invite-test-workspace-/);
  const slug = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`/w/${slug}/settings/members`);

  await page.getByPlaceholder("teammate@example.com").fill(memberEmail);
  await page.getByRole("button", { name: "Invite" }).click();

  await expect(page.getByText(memberEmail).first()).toBeVisible();

  const memberRoleSelect = page.locator("li", { hasText: memberEmail }).locator("select");
  await memberRoleSelect.selectOption("admin");
  await expect(memberRoleSelect).toHaveValue("admin");
});
