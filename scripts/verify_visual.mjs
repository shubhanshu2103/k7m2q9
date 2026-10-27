// Capture the served application for visual review. Needs a built frontend (npm run build)
// and a backend on port 8000. Set PW_CHROMIUM_PATH to use a preinstalled Chromium.
// Reduced motion keeps captures deterministic: chart animations would otherwise be mid-draw.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://127.0.0.1:8000";
const out = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {},
);
const shot = async (page, name) =>
  page.screenshot({ path: out + name, fullPage: true });

const desktop = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await desktop.goto(base + "/");
await desktop.locator(".run-list strong").first().waitFor();
await shot(desktop, "decision-desktop.png");
await desktop.getByRole("button", { name: "Reveal actuals" }).click();
await desktop
  .getByRole("heading", { name: "Where the miss happened" })
  .waitFor();
await shot(desktop, "retrospective-desktop.png");
await desktop.getByRole("button", { name: "02 Accuracy lab" }).click();
await desktop.getByText("Lowest full-coverage MAE").waitFor();
await shot(desktop, "analysis-desktop.png");

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
await mobile.goto(base + "/");
await mobile.locator(".run-list strong").first().waitFor();
await shot(mobile, "replay-mobile.png");
await mobile.goto(base + "/?view=method");
await mobile.locator(".source-list").waitFor();
await shot(mobile, "method-mobile.png");

const narrow = await browser.newPage({
  viewport: { width: 320, height: 720 },
  reducedMotion: "reduce",
});
await narrow.goto(
  base +
    "/?view=replay&decision=2026-01-01&cutoff=01:00&rule=hour_mean&reveal=1",
);
await narrow.getByText("No eligible forecast for 22:00, 23:00").waitFor();
await shot(narrow, "missing-coverage-320.png");

await browser.close();
console.log("Screenshots written to", out);
