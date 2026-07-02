import { expect, test, type Page } from "@playwright/test";
import { convertStuffToProjectApi, createAndSelectInboxStuff, createStuffApi, openApp, resetTestData, uniqueLabel } from "./support/app";

test.beforeEach(async ({ page, request }) => {
  await resetTestData(request);
  await openApp(page);
});

test("edits selected project title and deadline", async ({ page, request }) => {
  const title = uniqueLabel("Project edit");
  const updatedTitle = uniqueLabel("Project updated");
  await createAndSelectInboxStuff(page, title);
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  await page.keyboard.press("Enter");

  await expect(page.locator(".list-pane__title").first()).toHaveText("Projects");
  expect(await page.locator(".list-pane__title").first().evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(0);
  const projectCard = page.getByRole("button", { name: title, exact: false });
  await expect(projectCard).toBeVisible();
  await expect(projectCard).toHaveClass(/project-card/);
  expect(await projectCard.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(420);

  await page.keyboard.press("e");
  const editDialog = page.getByRole("dialog", { name: "Edit project" });
  await expect(editDialog).toBeVisible();
  await page.keyboard.press("t");
  await editDialog.getByRole("textbox", { name: "Title:" }).fill(updatedTitle);
  await page.keyboard.press("Enter");
  await expect(editDialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: updatedTitle, exact: false })).toBeVisible();

  await page.keyboard.press("e");
  await page.keyboard.press("d");
  await page.keyboard.type("29022028");
  const patchPromise = page.waitForRequest((request) => request.url().includes("/projects/") && request.method() === "PATCH");
  await page.keyboard.press("Enter");
  const patchRequest = await patchPromise;
  expect(patchRequest.postDataJSON()).toEqual({ deadline: "2028-02-29" });
  await expect(page.getByRole("button", { name: /29 Feb 2028/ })).toBeVisible();
});

test("moves down to the project card below", async ({ page, request }) => {
  const titles = await createProjectGrid(request);

  await page.keyboard.press("Space");
  await page.keyboard.press("p");
  await expect(page.locator(".project-card")).toHaveCount(titles.length);

  const firstCard = page.getByRole("button", { name: titles[0], exact: false });
  const rowBelowTitle = await firstTitleBelow(page);
  const rowBelowCard = page.getByRole("button", { name: rowBelowTitle, exact: false });
  await expect(firstCard).toHaveClass(/project-card--active/);
  await page.keyboard.press("j");
  await expect(rowBelowCard).toHaveClass(/project-card--active/);
});

test("marks project done, edits it in completed projects, and restores it", async ({ page, request }) => {
  const title = uniqueLabel("Project done");
  const updatedTitle = uniqueLabel("Project done updated");
  const stuff = await createStuffApi(request, title);
  await convertStuffToProjectApi(request, stuff.id);

  await page.keyboard.press("Space");
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  const doneResponse = page.waitForResponse((response) => response.url().includes("/projects/") && response.url().endsWith("/done") && response.ok());
  await page.keyboard.press("x");
  await doneResponse;
  await expect(page.getByRole("button", { name: title, exact: false })).not.toBeVisible();

  await page.keyboard.press("]");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Completed Projects");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  await page.keyboard.press("e");
  const editDialog = page.getByRole("dialog", { name: "Edit project" });
  await page.keyboard.press("t");
  await editDialog.getByRole("textbox", { name: "Title:" }).fill(updatedTitle);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: updatedTitle, exact: false })).toBeVisible();

  const resetResponse = page.waitForResponse((response) => response.url().includes("/projects/") && response.url().endsWith("/reset-status") && response.ok());
  await page.keyboard.press("r");
  await resetResponse;
  await expect(page.getByRole("button", { name: updatedTitle, exact: false })).not.toBeVisible();
  await page.keyboard.press("[");
  await expect(page.getByRole("button", { name: updatedTitle, exact: false })).toBeVisible();
});

test("deletes active project, undoes, redoes, and recovers from deleted projects", async ({ page, request }) => {
  const title = uniqueLabel("Project delete");
  const stuff = await createStuffApi(request, title);
  await convertStuffToProjectApi(request, stuff.id);

  await page.keyboard.press("Space");
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  await deleteSelectedProject(page);
  await page.keyboard.press("u");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  await page.keyboard.press("Control+r");
  await expect(page.getByRole("button", { name: title, exact: false })).not.toBeVisible();
  await page.keyboard.press("[");
  await expect(page.locator(".list-pane__title").first()).toHaveText("Deleted Projects");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();

  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: title, exact: false })).not.toBeVisible();
  await page.keyboard.press("]");
  await expect(page.getByRole("button", { name: title, exact: false })).toBeVisible();
});

async function deleteSelectedProject(page: Page): Promise<void> {
  const deleteResponse = page.waitForResponse((response) => response.url().includes("/projects/") && response.request().method() === "DELETE" && response.ok());
  await page.keyboard.press("d");
  await deleteResponse;
}

async function createProjectGrid(request: Parameters<typeof createStuffApi>[0]): Promise<string[]> {
  const titles = Array.from({ length: 8 }, (_, index) => uniqueLabel(`Project grid ${index + 1}`));
  for (const title of titles) {
    const stuff = await createStuffApi(request, title);
    await convertStuffToProjectApi(request, stuff.id);
  }
  return titles;
}

async function firstTitleBelow(page: Page): Promise<string> {
  return page.locator(".project-card").evaluateAll((cards) => {
    const first = cards[0].getBoundingClientRect();
    const below = cards
      .map((card) => ({ text: card.querySelector(".project-card__title")?.textContent ?? "", rect: card.getBoundingClientRect() }))
      .filter((card) => card.rect.top > first.top)
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)[0];
    return below.text.trim();
  });
}
