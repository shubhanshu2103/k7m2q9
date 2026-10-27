import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:8000" },
  webServer: {
    command: "python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000",
    url: "http://127.0.0.1:8000/api/health",
    reuseExistingServer: false,
  },
  workers: 1,
});
