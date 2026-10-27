import { test, expect } from "@playwright/test";
test("decision reveal, cutoff boundary, analysis and data provenance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tomorrow, as seen yesterday." }),
  ).toBeVisible();
  await expect(
    page.locator(".stat-value").filter({ hasText: "24/24" }),
  ).toBeVisible();
  await expect(
    page.locator(".stat-value").filter({ hasText: "Hidden" }),
  ).toBeVisible();
  await page.locator("#cutoff").fill("11:30");
  await expect(
    page
      .locator(".run-list strong")
      .filter({ hasText: "2026-01-15 09:30 UTC" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reveal actuals", exact: true })
    .click();
  await expect(
    page.getByText("Actuals revealed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SIGNED BIAS", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "02 Accuracy lab" }).click();
  await expect(
    page.locator(".stat-value").filter({ hasText: "744/744" }),
  ).toBeVisible();
  await page.locator("#rule").selectOption("first_half");
  await expect(page.getByText("First half-hour · selected")).toBeVisible();
  await page.getByRole("button", { name: "03 Data & method" }).click();
  await expect(
    page.locator(".stat-value").filter({ hasText: "19,856" }),
  ).toBeVisible();
  await expect(
    page.locator(".stat-value").filter({ hasText: "1,488" }),
  ).toBeVisible();
});
for (const width of [320, 390, 1440])
  test(`responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    for (const button of [null, "02 Accuracy lab", "03 Data & method"]) {
      await page.goto("/");
      if (button) await page.getByRole("button", { name: button }).click();
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
test("network failure shows a retry instead of stale data", async ({
  page,
}) => {
  await page.route("**/api/replay**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/replay**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.locator(".stat-value").filter({ hasText: "24/24" }),
  ).toBeVisible();
});

test("empty eligible forecast set stays blank, never Infinity or zero accuracy", async ({
  page,
}) => {
  await page.route("**/api/replay**", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.points = data.points.map((p) => ({
      ...p,
      forecast: null,
      publishTime: null,
    }));
    data.coverage = {
      forecast: 0,
      expected: 24,
      runs: [],
      fallback_intervals: 0,
    };
    await route.fulfill({ response, json: data });
  });
  await page.goto("/");
  await expect(
    page.locator(".stat-value").filter({ hasText: "0/24" }),
  ).toBeVisible();
  await expect(
    page.locator(".stat-value").filter({ hasText: "N/A" }),
  ).toBeVisible();
  await expect(page.getByText("Missing targets are left blank")).toBeVisible();
  await expect(page.getByText("Infinity")).toHaveCount(0);
});
