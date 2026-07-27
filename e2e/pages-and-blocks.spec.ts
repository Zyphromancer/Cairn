import { test, expect } from "@playwright/test";
import { signInAndCreateWorkspace } from "./helpers";

test("creating a page via the sidebar opens an editable, empty page", async ({ page }) => {
  const { slug } = await signInAndCreateWorkspace(page, "Editor Test WS");

  await page.getByRole("button", { name: "New page in Workspace" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${slug}/p/`));

  await page.locator('input[placeholder="Untitled"]').fill("My First Page");
  await expect(page.locator('input[placeholder="Untitled"]')).toHaveValue("My First Page");

  // Title save is debounced 500ms; wait it out before reloading so the
  // sidebar (server-revalidated) has something to reflect.
  await page.waitForTimeout(700);
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
  // Enter creates a new block and shifts focus to it asynchronously —
  // wait for the actual condition (focus landing) rather than guessing
  // a timeout, so this isn't sensitive to how loaded the page/server is.
  const secondBlock = editor.locator(".ProseMirror").nth(1);
  await expect(secondBlock).toBeFocused();
  await page.keyboard.type("Second block");

  await expect(editor.locator(".ProseMirror")).toHaveCount(2);
  await expect(editor.locator(".ProseMirror").nth(0)).toHaveText("First block");
  await expect(secondBlock).toHaveText("Second block");

  // Backspace at the start of the second (non-empty) block merges it into
  // the first. Reach position 0 via repeated ArrowLeft rather than "Home":
  // instrumenting the real keydown handler showed Home's native
  // contentEditable caret-move sometimes never lands under headless
  // Chromium + CDP's synthetic key dispatch (no remount, no
  // preventDefault, correct focus target — the selection just never
  // syncs, even 50ms later). ArrowLeft can't overshoot position 0, so
  // pressing it more times than the text is long reliably lands there
  // even if an individual keypress is occasionally dropped.
  await secondBlock.click();
  await expect(secondBlock).toBeFocused();
  for (let i = 0; i < "Second block".length + 5; i++) {
    await page.keyboard.press("ArrowLeft");
  }
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
  await page.getByRole("button", { name: "Heading 1" }).click();
  await expect(page.locator(".ProseMirror").first()).toBeFocused();

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
  await page.getByRole("button", { name: "To-do" }).click();
  await expect(page.locator(".ProseMirror").first()).toBeFocused();
  await page.keyboard.type("Buy milk");

  const checkbox = page.locator('input[type="checkbox"]');
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  // Checkbox toggle is flushed immediately (not debounced), but give the
  // fire-and-forget write a moment before reloading.
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('input[type="checkbox"]')).toBeChecked();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Buy milk");
});
