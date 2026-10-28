import { defineConfig } from "@playwright/test";
// Set E2E_BASE_URL to run the suite against a deployment instead of a local server.
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: remote ?? "http://127.0.0.1:8000",
    // Optional: point at a preinstalled Chromium when `playwright install` is unavailable.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: remote
    ? undefined
    : {
        command:
          "python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000",
        url: "http://127.0.0.1:8000/api/health",
        reuseExistingServer: false,
      },
  workers: 1,
});
