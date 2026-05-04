import { expect, test, type Page } from "@playwright/test";

type TextareaSelection = {
  end: number;
  start: number;
};

function uniqueTitle(): string {
  return `E2E vim cursor ${Date.now()}`;
}

async function focusApp(page: Page): Promise<void> {
  await page.locator("main").click();
}

async function createStuffFromKeyboard(page: Page, title: string): Promise<void> {
  await page.keyboard.press("a");
  const input = page.locator("input.tree-entry__input");
  await expect(input).toBeVisible();
  await input.fill(title);
  await input.press("Enter");
}

async function editNewStuffBody(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await focusApp(page);
  await createStuffFromKeyboard(page, title);
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.keyboard.press("l");
  await page.keyboard.press("Enter");
  await expect(page.locator(".inbox-detail__textarea")).toBeVisible();
}

async function writeBodyAndReturnToStart(page: Page, bodyText: string): Promise<void> {
  await page.keyboard.press("i");
  await page.keyboard.type(bodyText);
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("g");
}

async function moveNormalCursorRight(page: Page, count: number): Promise<void> {
  for (let step = 0; step < count; step += 1) {
    await page.keyboard.press("l");
    await expectNormalCursorIndex(page, step + 1);
  }
}

async function writeMultilineBodyAndReturnToStart(page: Page): Promise<void> {
  await page.keyboard.press("i");
  await page.keyboard.type("abc");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("def");
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("g");
}

async function textareaSelection(page: Page): Promise<TextareaSelection> {
  return page.locator(".inbox-detail__textarea").evaluate((textarea) => ({
    end: (textarea as HTMLTextAreaElement).selectionEnd,
    start: (textarea as HTMLTextAreaElement).selectionStart
  }));
}

async function textareaValue(page: Page): Promise<string> {
  return page.locator(".inbox-detail__textarea").evaluate((textarea) => (textarea as HTMLTextAreaElement).value);
}

async function expectTextareaSelection(page: Page, selection: TextareaSelection): Promise<void> {
  await expect.poll(() => textareaSelection(page)).toEqual(selection);
}

async function normalCursorText(page: Page): Promise<string | null> {
  return page.locator(".inbox-detail__normal-cursor").evaluate((element) => element.textContent);
}

async function normalCursorIndex(page: Page): Promise<number> {
  const index = await page.locator(".inbox-detail__normal-cursor").getAttribute("data-cursor-index");
  return Number.parseInt(index ?? "0", 10);
}

async function expectNormalCursorIndex(page: Page, index: number): Promise<void> {
  await expect.poll(() => normalCursorIndex(page)).toBe(index);
}

function expectedCursorText(value: string, index: number): string {
  return value[index] && value[index] !== "\n" ? value[index] : "\u00a0";
}

test("moves the normal-mode block cursor one character with h and l", async ({ page }) => {
  const title = uniqueTitle();
  await editNewStuffBody(page, title);
  await writeBodyAndReturnToStart(page, "abcdef");

  await expectNormalCursorIndex(page, 0);
  await page.keyboard.press("l");
  await expectNormalCursorIndex(page, 1);
  await page.keyboard.press("l");
  await expectNormalCursorIndex(page, 2);
  await page.keyboard.press("h");
  await expectNormalCursorIndex(page, 1);
  await page.keyboard.press("h");
  await expectNormalCursorIndex(page, 0);
});

test("keeps the normal-mode block cursor visible on empty lines", async ({ page }) => {
  const title = uniqueTitle();
  await editNewStuffBody(page, title);
  await writeMultilineBodyAndReturnToStart(page);

  await page.keyboard.press("j");
  const cursor = page.locator(".inbox-detail__normal-cursor");
  await expect(cursor).toBeVisible();
  await expect.poll(() => cursor.evaluate((element) => element.textContent)).toBe("\u00a0");
});

test("keeps the normal-mode block cursor stable on body spaces", async ({ page }) => {
  const title = uniqueTitle();
  const bodyText = "comprar presente pra ela ficar bem feliz";
  const cursorStart = bodyText.indexOf(" bem");

  await editNewStuffBody(page, title);
  await writeBodyAndReturnToStart(page, bodyText);
  await moveNormalCursorRight(page, bodyText.indexOf("bem"));
  await page.keyboard.press("h");
  await expectNormalCursorIndex(page, cursorStart);

  const cursor = page.locator(".inbox-detail__normal-cursor");
  const cursorBox = await cursor.boundingBox();

  await expect.poll(() => cursor.evaluate((element) => element.textContent)).toBe("\u00a0");
  expect(cursorBox?.width).toBeGreaterThan(0);
});

test("moves down by rendered wrapped lines instead of jumping to logical line end", async ({ page }) => {
  const title = uniqueTitle();
  const bodyText = `${"wrapped cursor movement ".repeat(12)}\nfazer o que se eu gosto disso kakakakkaka, mas é muito`;
  const cursorStart = 40;

  await page.setViewportSize({ width: 1024, height: 768 });
  await editNewStuffBody(page, title);
  await writeBodyAndReturnToStart(page, bodyText);
  await moveNormalCursorRight(page, cursorStart);
  await expectTextareaSelection(page, { end: cursorStart, start: cursorStart });

  await page.keyboard.press("j");

  const cursorIndex = await normalCursorIndex(page);
  expect(cursorIndex).toBeGreaterThan(cursorStart);
  expect(cursorIndex).toBeLessThanOrEqual(bodyText.indexOf("\n"));
});

test("keeps the rendered cursor character aligned with accented wrapped text", async ({ page }) => {
  const title = uniqueTitle();
  const bodyText = "aqui vai meu texto, textinho, textão, texto muitooooooo grande\nmas aqui eu pulo para a próxima linha para não ficar chat";
  const cursorStart = bodyText.indexOf("pesados,") === -1 ? 40 : bodyText.indexOf("pesados,");

  await page.setViewportSize({ width: 1024, height: 768 });
  await editNewStuffBody(page, title);
  await writeBodyAndReturnToStart(page, bodyText);
  await moveNormalCursorRight(page, cursorStart);
  await page.keyboard.press("j");

  const value = await textareaValue(page);
  const cursorIndex = await normalCursorIndex(page);
  expect(await normalCursorText(page)).toBe(expectedCursorText(value, cursorIndex));
});
