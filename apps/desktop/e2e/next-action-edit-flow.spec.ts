import { expect, test, type Page } from "@playwright/test";
import {
  createContextApi,
  createAndSelectInboxStuff,
  openApp,
  resetTestData,
  todayDisplayValue,
  todayIsoValue,
  uniqueLabel,
} from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("edits selected next action contexts with keyboard flow", async ({
  page,
  request,
}) => {
  const title = uniqueLabel("Next action edit");
  const firstContext = uniqueLabel("A edit context");
  const secondContext = uniqueLabel("B edit context");
  await createContextApi(request, firstContext);
  await createContextApi(request, secondContext);
  await createNextActionFromKeyboard(page, title);

  await openSelectedNextActionEditDialog(page, title);

  const dialog = page.getByRole("dialog", { name: "Edit next action" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Context");
  await page.keyboard.press("c");
  await expect(dialog.getByText(firstContext)).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("j");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(dialog).not.toBeVisible();
  await expect(page.locator("input.tree-entry__input")).not.toBeVisible();
  await expect(page.getByText(firstContext)).toBeVisible();
  await expect(page.getByText(secondContext)).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("i");
  await openNextActions(page);
  await expect(page.getByText(firstContext)).toBeVisible();
  await expect(page.getByText(secondContext)).toBeVisible();
  await page.reload();
  await page.locator("main").click();
  await openNextActions(page);
  await expect(page.getByText(firstContext)).toBeVisible();
  await expect(page.getByText(secondContext)).toBeVisible();
});

test("edits selected next action deadline with segmented keyboard flow", async ({
  page,
}) => {
  const title = uniqueLabel("Next action deadline");
  await createNextActionFromKeyboard(page, title);

  await openSelectedNextActionEditDialog(page, title);

  const dialog = page.getByRole("dialog", { name: "Edit next action" });
  await page.keyboard.press("d");
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await expect(dateControl).toHaveText("__/__/____");
  const deadlineRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes("/next-actions/") && request.method() === "PATCH",
  );
  await page.keyboard.type("29022028");
  await page.keyboard.press("Enter");

  const deadlineRequest = await deadlineRequestPromise;
  expect(deadlineRequest.postDataJSON()).toEqual({ deadline: "2028-02-29" });
  await expect(dialog).not.toBeVisible();
});

test("sets selected next action deadline to today with keyboard flow", async ({
  page,
}) => {
  const title = uniqueLabel("Next action today deadline");
  await createNextActionFromKeyboard(page, title);

  await openSelectedNextActionEditDialog(page, title);

  const dialog = page.getByRole("dialog", { name: "Edit next action" });
  await page.keyboard.press("d");
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await page.keyboard.type("29022028");
  await page.keyboard.press("t");
  await expect(dateControl).toHaveText(todayDisplayValue());
  await expect(dialog.getByText("Energy")).not.toBeVisible();

  const deadlineRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes("/next-actions/") && request.method() === "PATCH",
  );
  await page.keyboard.press("Enter");

  const deadlineRequest = await deadlineRequestPromise;
  expect(deadlineRequest.postDataJSON()).toEqual({ deadline: todayIsoValue() });
  await expect(dialog).not.toBeVisible();
});

for (const field of ["energy", "time"] as const) {
  test(`clears edited ${field} to zero and persists after reload`, async ({
    page,
  }) => {
    const title = uniqueLabel(`Clear ${field}`);
    await createNextActionFromKeyboard(page, title);
    await openSelectedNextActionEditDialog(page, title);
    await editNumericAttribute(page, field, field === "energy" ? "85" : "130");
    await page.keyboard.press("Shift+E");
    const cleared = await editNumericAttribute(page, field, "");
    expect(cleared).toMatchObject(
      field === "energy" ? { energy: 0 } : { estimatedTime: "PT0S" },
    );
    await page.reload();
    await page.locator("main").click();
    await openSelectedNextActionEditDialog(page, title);
    await page.keyboard.press(field === "energy" ? "e" : "t");
    const input = page.locator(`.processing-dialog__input--${field}`);
    await expect(input).toHaveValue(field === "energy" ? "0.0" : "0min");
  });
}

async function editNumericAttribute(
  page: Page,
  field: "energy" | "time",
  digits: string,
): Promise<unknown> {
  await page.keyboard.press(field === "energy" ? "e" : "t");
  const input = page.locator(`.processing-dialog__input--${field}`);
  await expect(input).toBeFocused();
  for (let index = 0; index < 4; index++)
    await page.keyboard.press("Backspace");
  if (digits) await page.keyboard.type(digits);
  const response = page.waitForResponse(
    (reply) =>
      reply.url().includes("/next-actions/") &&
      reply.request().method() === "PATCH",
  );
  await page.keyboard.press("Enter");
  const saved = await response;
  expect(saved.ok()).toBeTruthy();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  return saved.json();
}

test("clears the deadline and keeps it empty after reload", async ({
  page,
}) => {
  const title = uniqueLabel("Clear deadline");
  await createNextActionFromKeyboard(page, title);
  await openSelectedNextActionEditDialog(page, title);
  await saveDeadlineDigits(page, "29022028");
  await page.keyboard.press("Shift+E");
  expect(await saveDeadlineDigits(page, "")).toMatchObject({ deadline: null });
  await page.reload();
  await page.locator("main").click();
  await openSelectedNextActionEditDialog(page, title);
  await page.keyboard.press("d");
  await expect(page.getByRole("textbox", { name: "Deadline:" })).toHaveText(
    "__/__/____",
  );
});

async function saveDeadlineDigits(
  page: Page,
  digits: string,
): Promise<unknown> {
  await page.keyboard.press("d");
  await expect(page.getByRole("textbox", { name: "Deadline:" })).toBeVisible();
  await page.keyboard.press("Delete");
  if (digits) await page.keyboard.type(digits);
  const response = page.waitForResponse(
    (reply) =>
      reply.url().includes("/next-actions/") &&
      reply.request().method() === "PATCH",
  );
  await page.keyboard.press("Enter");
  const saved = await response;
  expect(saved.ok()).toBeTruthy();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  return saved.json();
}

test("cancels every attribute step without sending edits or leaking modal shortcuts", async ({
  page,
}) => {
  const title = uniqueLabel("Cancel attributes");
  await createNextActionFromKeyboard(page, title);
  await openSelectedNextActionEditDialog(page, title);
  const patches: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH") patches.push(request.url());
  });
  for (const shortcut of ["c", "e", "t", "d"]) {
    await page.keyboard.press(shortcut);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toContainText("Estimated time");
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: title }).first()).toBeVisible();
  expect(patches).toEqual([]);
});

async function createNextActionFromKeyboard(
  page: Page,
  title: string,
): Promise<void> {
  await page.keyboard.press(" ");
  await page.keyboard.press("i");
  await createAndSelectInboxStuff(page, title);
  await page.keyboard.press("p");
  await page.keyboard.press("n");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/next-action") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.keyboard.press("Enter");
  await response;
}

async function openNextActions(page: Page): Promise<void> {
  await page.keyboard.press(" ");
  await page.keyboard.press("n");
  await expect(
    page.locator(".list-pane__title", { hasText: "Next Actions" }).first(),
  ).toBeVisible();
}

async function selectNextAction(page: Page, title: string): Promise<void> {
  const nextAction = page.getByRole("button", { name: title }).first();
  await expect(nextAction).toBeVisible();
  await nextAction.click();
}

async function openSelectedNextActionEditDialog(
  page: Page,
  title: string,
): Promise<void> {
  await openNextActions(page);
  await selectNextAction(page, title);
  await page.keyboard.press("Shift+E");
}
