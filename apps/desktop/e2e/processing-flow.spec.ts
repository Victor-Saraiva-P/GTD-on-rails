import { expect, test, type Page } from "@playwright/test";
import { createContextApi, createAndSelectInboxStuff, openApp, resetTestData, todayDisplayValue, todayIsoValue, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("p opens processing command page for focused inbox stuff", async ({ page }) => {
  const title = uniqueLabel("Processing flow");
  await createAndSelectInboxStuff(page, title);

  await page.keyboard.press("p");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Processing");
  await expect(dialog).toContainText("n");
  await expect(dialog).toContainText("Next actions");

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("selects multiple next action contexts with keyboard", async ({ page, request }) => {
  const title = uniqueLabel("Processing flow");
  const firstContext = `A processing ${Date.now()}`;
  const secondContext = `B processing ${Date.now()}`;
  await createContextApi(request, firstContext);
  await createContextApi(request, secondContext);
  await createAndSelectInboxStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("n");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog.getByRole("textbox", { name: "Deadline:" })).toHaveText("__/__/____");
  await page.keyboard.press("Enter");
  await expect(dialog.getByText(firstContext)).toBeVisible();
  await expect(dialog.getByText(secondContext)).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("j");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(dialog.getByText("Energy level")).toBeVisible();
});

test("enters next action deadline before contexts", async ({ page }) => {
  const title = uniqueLabel("Processing deadline");
  await createAndSelectInboxStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("n");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await expect(dateControl).toHaveText("__/__/____");
  await page.keyboard.type("29022028");
  await expect(dateControl).toHaveText("29/02/2028");

  const nextActionRequestPromise = page.waitForRequest((request) => request.url().endsWith("/next-action") && request.method() === "POST");
  await confirmNextActionProcessing(page);

  const nextActionRequest = await nextActionRequestPromise;
  const payload = nextActionRequest.postDataJSON() as NextActionProcessingRequestPayload;
  expect(payload.deadline).toEqual("2028-02-29");
});

test("sets processing next action deadline to today with keyboard", async ({ page }) => {
  const title = uniqueLabel("Processing today deadline");
  await createAndSelectInboxStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("n");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await page.keyboard.type("29022028");
  await page.keyboard.press("t");
  await expect(dateControl).toHaveText(todayDisplayValue());
  await expect(dialog.getByText("Context")).not.toBeVisible();

  const nextActionRequestPromise = page.waitForRequest((request) => request.url().endsWith("/next-action") && request.method() === "POST");
  await confirmNextActionProcessing(page);

  const nextActionRequest = await nextActionRequestPromise;
  const payload = nextActionRequest.postDataJSON() as NextActionProcessingRequestPayload;
  expect(payload.deadline).toEqual(todayIsoValue());
});

test("enters calendar date with segmented keyboard input", async ({ page }) => {
  const title = uniqueLabel("Processing calendar");
  await createAndSelectInboxStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("c");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  const dateControl = dialog.getByRole("textbox", { name: "Scheduled date:" });
  const dateSegments = dialog.locator(".processing-dialog__date-segment");
  await expect(dateControl).toHaveText(todayDisplayValue());
  await expect(dateSegments.nth(0)).toHaveClass(/processing-dialog__date-segment--active/);

  await page.keyboard.press("Backspace");
  await expect(dateControl).toHaveText(todayDisplayValue());

  await page.keyboard.type("31");
  await expect(dateSegments.nth(1)).toHaveClass(/processing-dialog__date-segment--active/);
  await page.keyboard.type("02");
  await expect(dateSegments.nth(2)).toHaveClass(/processing-dialog__date-segment--active/);
  await page.keyboard.type("2026");
  await expect(dateSegments.nth(0)).toHaveClass(/processing-dialog__date-segment--active/);

  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("alert")).toHaveText("Enter a valid calendar date.");
  await expect(dialog.getByText("Scheduled time (optional):")).not.toBeVisible();

  await page.keyboard.press("l");
  await expect(dateSegments.nth(1)).toHaveClass(/processing-dialog__date-segment--active/);
  await page.keyboard.press("l");
  await page.keyboard.press("l");
  await expect(dateSegments.nth(2)).toHaveClass(/processing-dialog__date-segment--active/);
  await page.keyboard.press("h");
  await expect(dateSegments.nth(1)).toHaveClass(/processing-dialog__date-segment--active/);
  await page.keyboard.press("h");

  await page.keyboard.type("29022028");
  await expect(dateControl).toHaveText("29/02/2028");

  const calendarRequestPromise = page.waitForRequest((request) => request.url().endsWith("/calendar") && request.method() === "POST");
  await page.keyboard.press("Enter");
  await expect(dialog.getByText("Scheduled time (optional):")).toBeVisible();
  await page.keyboard.press("Enter");

  const calendarRequest = await calendarRequestPromise;
  const payload = calendarRequest.postDataJSON() as CalendarProcessingRequestPayload;
  expect(payload).toEqual({ scheduledDate: "2028-02-29", scheduledTime: null });
});

test("processes stuff into a project and opens projects", async ({ page }) => {
  const title = uniqueLabel("Processing project");
  await createAndSelectInboxStuff(page, title);

  await page.keyboard.press("p");
  await page.keyboard.press("p");

  const dialog = page.getByRole("dialog", { name: "Processing" });
  const dateControl = dialog.getByRole("textbox", { name: "Deadline:" });
  await expect(dateControl).toHaveText("__/__/____");

  const projectRequestPromise = page.waitForRequest((request) => request.url().endsWith("/project") && request.method() === "POST");
  await page.keyboard.type("29022028");
  await page.keyboard.press("Enter");

  const projectRequest = await projectRequestPromise;
  const payload = projectRequest.postDataJSON() as ProjectProcessingRequestPayload;
  expect(payload.deadline).toEqual("2028-02-29");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Projects");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();
});

async function confirmNextActionProcessing(page: Page): Promise<void> {
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
}

type CalendarProcessingRequestPayload = {
  scheduledDate: string;
  scheduledTime: string | null;
};

type NextActionProcessingRequestPayload = {
  deadline: string | null;
};

type ProjectProcessingRequestPayload = {
  deadline: string | null;
};
