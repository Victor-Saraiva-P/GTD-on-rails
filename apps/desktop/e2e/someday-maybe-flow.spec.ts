import { expect, test } from "@playwright/test";
import { apiBaseUrl, convertStuffToProjectApi, createAndSelectInboxStuff, createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
  await expect(page.getByText("Inbox is empty.")).toBeVisible();
});

test("processes stuff into someday/maybe, navigates via Space s, and reverts to inbox with r", async ({ page }) => {
  const title = uniqueLabel("Learn Piano");
  await createAndSelectInboxStuff(page, title);

  // Open processing dialog
  await page.keyboard.press("p");
  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog).toBeVisible();
  const somedayButton = dialog.getByRole("button", { name: /Someday\/Maybe/ });
  await expect(somedayButton).toBeVisible();
  await somedayButton.focus();

  // Press 's' to convert to Someday/Maybe
  const somedayMaybeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/someday-maybe") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("s");
  await somedayMaybeResponsePromise;
  await expect(dialog).not.toBeVisible();

  // Navigate to Someday/Maybe with Space s
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("s");
  await expect(page.locator(".leader-menu")).not.toBeVisible();

  // Verify Someday/Maybe page loaded with the item
  await expect(page.locator(".list-pane__title").first()).toHaveText("Someday/Maybe");
  const somedayItem = page.getByRole("button", { name: title, exact: false });
  await expect(somedayItem).toBeVisible();

  // Revert back to inbox with 'r'
  const revertResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/stuff") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("r");
  await revertResponsePromise;
  await expect(page.getByText("No someday/maybe items.")).toBeVisible();

  // Navigate back to inbox with Space i
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("i");
  await expect(page.locator(".leader-menu")).not.toBeVisible();

  // Verify item is back in inbox
  await expect(page.locator(".inbox-pane--list").getByRole("button", { name: title, exact: false }).first()).toBeVisible();
});

test("deletes someday/maybe item, switches to deleted subview with ], and restores it with r", async ({ page }) => {
  const title = uniqueLabel("Learn Archery");
  await createAndSelectInboxStuff(page, title);

  // Convert to Someday/Maybe
  await page.keyboard.press("p");
  const dialog = page.getByRole("dialog", { name: "Processing" });
  await expect(dialog).toBeVisible();
  const somedayButton = dialog.getByRole("button", { name: /Someday\/Maybe/ });
  await expect(somedayButton).toBeVisible();
  await somedayButton.focus();
  const somedayMaybeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/someday-maybe") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("s");
  await somedayMaybeResponsePromise;

  // Navigate to Someday/Maybe
  await page.keyboard.press("Space");
  await page.keyboard.press("s");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Someday/Maybe");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  // Delete item with 'd'
  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/items/") && response.request().method() === "DELETE" && response.ok()
  );
  await page.keyboard.press("d");
  await deleteResponsePromise;
  await expect(page.getByText("No someday/maybe items.")).toBeVisible();

  // Switch to deleted subview with ']'
  await page.keyboard.press("]");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Deleted Someday/Maybe");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  // Recover item with 'r'
  const restoreResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/restore") && response.request().method() === "POST" && response.ok()
  );
  await page.keyboard.press("r");
  await restoreResponsePromise;
  await expect(page.getByText("No deleted someday/maybe items.")).toBeVisible();

  // Switch back to active subview with '['
  await page.keyboard.press("[");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Someday/Maybe");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();
});

test("displays someday/maybe and ongoing items inside project detail", async ({ page, request }) => {
  const projectTitle = uniqueLabel("Office Setup");
  const project = await createStuffApi(request, projectTitle);
  await convertStuffToProjectApi(request, project.id);

  const stuffRes1 = await request.post(`${apiBaseUrl}/projects/${project.id}/items/stuff`, { data: { title: "Buy beanbag" } });
  const stuff1 = await stuffRes1.json();
  await request.post(`${apiBaseUrl}/inbox/${stuff1.id}/someday-maybe`);

  const stuffRes2 = await request.post(`${apiBaseUrl}/projects/${project.id}/items/stuff`, { data: { title: "Assemble desk" } });
  const stuff2 = await stuffRes2.json();
  await request.post(`${apiBaseUrl}/inbox/${stuff2.id}/next-action`, { data: { energy: 3, estimatedTime: { hours: 1, minutes: 0 }, contextIds: [], deadline: null } });
  await request.post(`${apiBaseUrl}/next-actions/${stuff2.id}/ongoing`);

  await openApp(page);
  await expect(page.getByText("Loading inbox...")).not.toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator(".leader-menu")).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.locator(".leader-menu")).not.toBeVisible();

  const projectCard = page.getByRole("button", { name: projectTitle, exact: false });
  await expect(projectCard).toBeVisible();
  await projectCard.click();
  await page.keyboard.press("Enter");

  await expect(page.locator(".list-pane__title").first()).toHaveText(projectTitle);

  const somedayItem = page.locator(".tree-list--inbox").getByRole("button", { name: "Buy beanbag", exact: false });
  await expect(somedayItem).toBeVisible();
  await expect(somedayItem.locator(".tree-entry__glyph--project-someday-maybe")).toBeVisible();
  await expect(somedayItem.locator(".tree-entry__glyph--project-someday-maybe")).toHaveText("S");

  const ongoingItem = page.locator(".tree-list--inbox").getByRole("button", { name: "Assemble desk", exact: false });
  await expect(ongoingItem).toBeVisible();
  await expect(ongoingItem.locator(".tree-entry__glyph--project-ongoing")).toBeVisible();
  await expect(ongoingItem.locator(".tree-entry__glyph--project-ongoing")).toHaveText("N");
});
