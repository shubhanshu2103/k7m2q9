import { test, expect } from "@playwright/test";

const stat = (page, text) =>
  page.locator(".stat-value").filter({ hasText: text });
const mode = (page) => page.getByRole("region", { name: "View mode" });

test("decision view, delayed run boundary, reveal, analysis and provenance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tomorrow, as seen yesterday." }),
  ).toBeVisible();
  await expect(mode(page)).toContainText("Decision view");
  await expect(stat(page, "24/24")).toBeVisible();
  // Earlier eligible runs are shown, none after the cutoff.
  await expect(page.locator(".run-list li.earlier")).toHaveCount(3);

  // 15 Jan: the usual 11:30 run was recorded at 12:25, so 11:30 must still use 09:30.
  await page.locator("#cutoff").fill("11:30");
  await expect(page.locator(".run-list strong")).toHaveText([
    "2026-01-15 09:30 UTC",
  ]);
  await page.locator("#cutoff").fill("12:25");
  await expect(page.locator(".run-list strong")).toHaveText([
    "2026-01-15 12:25 UTC",
  ]);

  await page.getByRole("button", { name: "Reveal actuals" }).click();
  await expect(mode(page)).toContainText("Hindsight view");
  await expect(
    page.getByRole("button", { name: "Hide actuals" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Signed bias", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Where the miss happened" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "02 Accuracy lab" }).click();
  await expect(stat(page, "744/744")).toBeHidden(); // cutoff 12:25 carried over
  await page.locator("#cutoff").fill("09:30");
  await expect(stat(page, "744/744")).toBeVisible();
  await expect(stat(page, "2,013")).toBeVisible();
  await expect(stat(page, "+1,730")).toBeVisible();
  await expect(page.getByText("Lowest full-coverage MAE")).toBeVisible();
  await page.locator("#rule").selectOption("first_half");
  await expect(page.getByText("First half-hour only · selected")).toBeVisible();

  await page.getByRole("button", { name: "03 Data & method" }).click();
  await expect(stat(page, "19,856")).toBeVisible();
  await expect(stat(page, "1,488")).toBeVisible();
});

test("a new day or cutoff returns to the decision view; a rule change does not", async ({
  page,
}) => {
  await page.goto("/");
  const reveal = page.getByRole("button", { name: "Reveal actuals" });
  await reveal.click();
  await expect(mode(page)).toContainText("Hindsight view");
  await page.locator("#rule").selectOption("first_half");
  await expect(mode(page)).toContainText("Hindsight view");

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(mode(page)).toContainText("Decision view");
  await expect(page.locator(".key.actual")).toHaveCount(0);
  await expect(page.getByText("Signed bias", { exact: true })).toHaveCount(0);
  await expect(page.locator("#rule")).toHaveCount(0); // irrelevant before reveal
  await expect(
    page.getByRole("link", { name: /Export decision CSV/ }),
  ).toHaveAttribute("href", /reveal=false/);

  await reveal.click();
  await page.locator("#cutoff").fill("10:00");
  await expect(mode(page)).toContainText("Decision view");

  await reveal.click();
  await page.getByRole("button", { name: "02 Accuracy lab" }).click();
  await page.getByRole("button", { name: "01 Decision replay" }).click();
  await expect(mode(page)).toContainText("Decision view");
});

test("worst day drill-through keeps cutoff and rule, labels hindsight, and Back returns", async ({
  page,
}) => {
  await page.goto("/?view=analysis&cutoff=09:30&rule=first_half");
  const first = page.locator(".inspect button").first();
  await expect(first).toContainText("Delivery Wed 28 Jan");
  await first.click();
  await expect(page).toHaveURL(/view=replay/);
  await expect(page).toHaveURL(/decision=2026-01-27/);
  await expect(page).toHaveURL(/cutoff=09%3A30/);
  await expect(page).toHaveURL(/rule=first_half/);
  await expect(mode(page)).toContainText("Hindsight view");
  await expect(mode(page)).toContainText("Opened from the Accuracy lab");
  await expect(page.locator("#rule")).toHaveValue("first_half");
  await expect(page.locator(".context-line")).toContainText("Wed 28 Jan");

  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "How much did the forecast miss?" }),
  ).toBeVisible();
  await page.goForward();
  await expect(mode(page)).toContainText("Hindsight view");
});

test("deep links restore a scenario and invalid values fall back visibly", async ({
  page,
}) => {
  await page.goto(
    "/?view=replay&decision=2026-01-01&cutoff=01:00&rule=hour_mean&reveal=0",
  );
  await expect(stat(page, "22/24")).toBeVisible();
  await expect(
    page.getByText("No eligible forecast for 22:00, 23:00"),
  ).toBeVisible();

  await page.goto(
    "/?view=replay&decision=2026-02-01&cutoff=25:00&rule=hour_mean",
  );
  await expect(page.getByText(/invalid decision, cutoff values/)).toBeVisible();
  await expect(page.locator("#decision")).toHaveValue("2026-01-15");
  await expect(page.locator("#cutoff")).toHaveValue("09:30");
  await expect(page).toHaveURL(/decision=2026-01-15/);

  // Hindsight cannot be requested for a non-replay view through the URL.
  await page.goto("/?view=analysis&reveal=1");
  await page.getByRole("button", { name: "01 Decision replay" }).click();
  await expect(mode(page)).toContainText("Decision view");
});

test("a slow older request never overwrites a newer scenario", async ({
  page,
}) => {
  await page.route("**/api/replay?decision=2026-01-16*", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => {});
  });
  await page.goto("/");
  await expect(stat(page, "24/24")).toBeVisible();
  const next = page.getByRole("button", { name: "Next day" });
  await next.click();
  await next.click();
  await expect(page.locator(".context-line")).toContainText("Sun 18 Jan");
  await page.waitForTimeout(1800);
  await expect(page.locator(".context-line")).toContainText("Sun 18 Jan");
  await expect(page.locator("#decision")).toHaveValue("2026-01-17");
});

test("keyboard navigation moves focus to the new screen and toggles hindsight", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "02 Accuracy lab" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByRole("button", { name: "01 Decision replay" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Reveal actuals" }).focus();
  await page.keyboard.press("Space");
  await expect(mode(page)).toContainText("Hindsight view");
  await expect(
    page.getByRole("button", { name: "01 Decision replay" }),
  ).toHaveAttribute("aria-current", "page");
});

test("immutable metadata is requested once per session", async ({ page }) => {
  let metaCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/meta")) metaCalls++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Next day" }).click();
  await page.getByRole("button", { name: "03 Data & method" }).click();
  await expect(stat(page, "19,856")).toBeVisible();
  await page.getByRole("button", { name: "01 Decision replay" }).click();
  await page.getByRole("button", { name: "03 Data & method" }).click();
  await expect(stat(page, "19,856")).toBeVisible();
  expect(metaCalls).toBe(1);
});

for (const width of [320, 390, 1440])
  test(`responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    for (const view of ["replay", "analysis", "method"]) {
      await page.goto(`/?view=${view}`);
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.locator("details summary").first().click();
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
  await expect(page.getByRole("alert")).toContainText("Replay could not load");
  await expect(page.locator(".stat-value")).toHaveCount(0);
  await page.unroute("**/api/replay**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(stat(page, "24/24")).toBeVisible();
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
    data.prior_runs = [];
    await route.fulfill({ response, json: data });
  });
  await page.goto("/");
  await expect(stat(page, "0/24")).toBeVisible();
  await expect(stat(page, "None")).toBeVisible();
  await expect(
    page.getByText("Nothing was published before this cutoff"),
  ).toBeVisible();
  // Case-sensitive whole words: a plain substring match would hit "provenance".
  await expect(page.getByText(/\bInfinity\b/)).toHaveCount(0);
  await expect(page.getByText(/\bNaN\b/)).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(
    /\bNaN\b|Infinity/,
  );
});
