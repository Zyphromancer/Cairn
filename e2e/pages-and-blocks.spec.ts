import { test, expect, type Page } from "@playwright/test";

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

async function signInAndCreateWorkspace(page: Page, workspaceName: string) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await page.getByPlaceholder("Acme Inc").fill(workspaceName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/w\//);
  const slug = new URL(page.url()).pathname.split("/")[2];
  return { email, slug };
}

test("creating a page via the sidebar opens an editable, empty page", async ({ page }) => {
  const { slug } = await signInAndCreateWorkspace(page, "Editor Test WS");

  await page.getByRole("button", { name: "New page in Workspace" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${slug}/p/`));

  await page.locator('input[placeholder="Untitled"]').fill("My First Page");
  await expect(page.locator('input[placeholder="Untitled"]')).toHaveValue("My First Page");

  // Sidebar reflects the title after a refresh (server-revalidated).
  await page.reload();
  await expect(page.getByText("My First Page")).toBeVisible();
});

test("typing, Enter, and Backspace create/merge blocks correctly", async ({ page }) => {
  await signInAndCreateWorkspace(page, "Block Editing WS");
  await page.getByRole("button", { name: "New page in Workspace" }).click();
  await expect(page).toHaveURL(/\/p\//);

  const editor = page.locator(".flex.flex-col.gap-0\\.5");
  const firstBlock = editor.locator(".ProseMirror").first();
  await firstBlock.click();
  await page.keyboard.type("First block");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second block");

  await expect(editor.locator(".ProseMirror")).toHaveCount(2);
  await expect(editor.locator(".ProseMirror").nth(0)).toHaveText("First block");
  await expect(editor.locator(".ProseMirror").nth(1)).toHaveText("Second block");

  // Backspace at the start of the second (non-empty) block merges it into the first.
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");

  await expect(editor.locator(".ProseMirror")).toHaveCount(1);
  await expect(editor.locator(".ProseMirror").first()).toHaveText("First blockSecond block");
});

test("slash menu turns a block into a heading", async ({ page }) => {
  await signInAndCreateWorkspace(page, "Slash Menu WS");
  await page.getByRole("button", { name: "New page in Workspace" }).click();
  await expect(page).toHaveURL(/\/p\//);

  const firstBlock = page.locator(".ProseMirror").first();
  await firstBlock.click();
  await page.keyboard.type("/head");
  await expect(page.getByText("Heading 1")).toBeVisible();
  await page.getByText("Heading 1").click();

  await expect(page.locator("h1, div:has(> .ProseMirror)").first()).toBeVisible();
  await page.keyboard.type("A heading");
  await expect(page.locator(".ProseMirror").first()).toHaveText("A heading");
});

test("to-do checkbox toggles and persists across reload", async ({ page }) => {
  await signInAndCreateWorkspace(page, "Todo WS");
  await page.getByRole("button", { name: "New page in Workspace" }).click();
  await expect(page).toHaveURL(/\/p\//);

  const firstBlock = page.locator(".ProseMirror").first();
  await firstBlock.click();
  await page.keyboard.type("/to-do");
  await page.getByText("To-do").click();
  await page.keyboard.type("Buy milk");

  const checkbox = page.locator('input[type="checkbox"]');
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(page.locator('input[type="checkbox"]')).toBeChecked();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Buy milk");
});
