import { test, expect, type Page } from "@playwright/test";
import { openFreshPage } from "./helpers";

// Every conversion remounts the block's editor (different wrapper JSX =
// React remount, see block-editor.tsx), and focus is re-armed via
// autoFocus on the new instance. Waiting for focus to land before typing
// the follow-up text matters at Playwright speed: keys dispatched in the
// tick between conversion and remount would go to the old, about-to-be-
// discarded editor instance. Same pattern as the slash-menu test.
async function typeTrigger(page: Page, trigger: string) {
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type(trigger);
  await expect(page.locator(".ProseMirror").first()).toBeFocused();
}

test("'# ' converts an empty block to heading 1", async ({ page }) => {
  await openFreshPage(page, "MD H1 WS");
  await typeTrigger(page, "# ");
  await page.keyboard.type("Big heading");

  const heading = page.locator("div.text-2xl .ProseMirror");
  await expect(heading).toHaveText("Big heading");
});

test("'## ' converts an empty block to heading 2", async ({ page }) => {
  await openFreshPage(page, "MD H2 WS");
  await typeTrigger(page, "## ");
  await page.keyboard.type("Medium heading");

  const heading = page.locator("div.text-xl .ProseMirror");
  await expect(heading).toHaveText("Medium heading");
});

test("'### ' converts an empty block to heading 3", async ({ page }) => {
  await openFreshPage(page, "MD H3 WS");
  await typeTrigger(page, "### ");
  await page.keyboard.type("Small heading");

  const heading = page.locator("div.text-lg .ProseMirror");
  await expect(heading).toHaveText("Small heading");
});

test("'- ' converts an empty block to a bulleted list item", async ({ page }) => {
  await openFreshPage(page, "MD Dash WS");
  await typeTrigger(page, "- ");
  await page.keyboard.type("Dash item");

  await expect(page.getByText("•").first()).toBeVisible();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Dash item");
});

test("'* ' converts an empty block to a bulleted list item", async ({ page }) => {
  await openFreshPage(page, "MD Star WS");
  await typeTrigger(page, "* ");
  await page.keyboard.type("Star item");

  await expect(page.getByText("•").first()).toBeVisible();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Star item");
});

test("'1. ' converts an empty block to a numbered list item", async ({ page }) => {
  await openFreshPage(page, "MD Num WS");
  await typeTrigger(page, "1. ");
  await page.keyboard.type("Numbered item");

  await expect(page.getByText("1.").first()).toBeVisible();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Numbered item");
});

test("'[] ' converts an empty block to an unchecked to-do", async ({ page }) => {
  await openFreshPage(page, "MD Todo WS");
  await typeTrigger(page, "[] ");
  await page.keyboard.type("Task");

  const checkbox = page.locator('input[type="checkbox"]');
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Task");
});

test("'[x] ' converts an empty block to a checked to-do", async ({ page }) => {
  await openFreshPage(page, "MD Todo Checked WS");
  await typeTrigger(page, "[x] ");
  await page.keyboard.type("Done task");

  const checkbox = page.locator('input[type="checkbox"]');
  await expect(checkbox).toBeChecked();
  await expect(page.locator(".ProseMirror").first()).toHaveText("Done task");
});

test("'> ' converts an empty block to a quote", async ({ page }) => {
  await openFreshPage(page, "MD Quote WS");
  await typeTrigger(page, "> ");
  await page.keyboard.type("A quote");

  const quote = page.locator("div.border-l-2.italic .ProseMirror");
  await expect(quote).toHaveText("A quote");
});

test("'```' converts an empty block to a code block", async ({ page }) => {
  await openFreshPage(page, "MD Code WS");
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type("```");

  // The empty <code contentEditable> has zero rendered size until text is
  // typed, which Playwright's toBeVisible treats as hidden — assert on
  // the styled <pre> wrapper instead, plus attachment of the code node.
  await expect(page.locator("pre")).toBeVisible();
  await expect(page.locator("pre code")).toBeAttached();
  await expect(page.locator("pre code")).toHaveText("");
});

test("'---' converts an empty block to a divider and adds a paragraph after it", async ({ page }) => {
  await openFreshPage(page, "MD Divider WS");
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type("---");

  await expect(page.locator("hr")).toBeVisible();
  // The divider itself isn't text-editable; the trigger consumes the
  // original block and inserts + focuses a fresh paragraph after it, so
  // the ProseMirror count stays at one rather than growing to two.
  await expect(page.locator(".ProseMirror")).toHaveCount(1);
  await expect(page.locator(".ProseMirror").first()).toBeFocused();
});

test("'#hashtag' without a trailing space does not convert", async ({ page }) => {
  await openFreshPage(page, "MD Negative WS");
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type("#hashtag");

  await expect(page.locator(".ProseMirror").first()).toHaveText("#hashtag");
  await expect(page.locator("div.text-2xl")).toHaveCount(0);
});

test("undo restores the literal trigger text after a conversion", async ({ page }) => {
  await openFreshPage(page, "MD Undo WS");
  await typeTrigger(page, "# ");
  await expect(page.locator("div.text-2xl")).toBeVisible();

  // typeTrigger already waited for the remounted editor to hold focus, so
  // this Cmd/Ctrl+Z reaches the editor's keydown handler (the app-level
  // one-shot conversion undo), not the page.
  await page.keyboard.press("Control+z");

  await expect(page.locator("div.text-2xl")).toHaveCount(0);
  await expect(page.locator(".ProseMirror").first()).toHaveText("# ");
});
