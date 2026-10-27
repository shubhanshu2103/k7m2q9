"""Capture actual served application. Requires pip install playwright and browser."""

import subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
p = subprocess.Popen(["python", "-m", "uvicorn", "backend.app:app", "--port", "8000"], cwd=ROOT)
try:
    for i in range(100):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/api/health")
            break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError("Server did not start")
    (ROOT / "screenshots").mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1080}, device_scale_factor=1)
        page.goto("http://127.0.0.1:8000")
        page.locator(".stat-value").first.wait_for()
        page.screenshot(path=str(ROOT / "screenshots/decision-desktop.png"), full_page=True)
        page.get_by_role("button", name="Reveal actuals", exact=True).click()
        page.locator(".run-list strong").wait_for()
        page.screenshot(path=str(ROOT / "screenshots/retrospective-desktop.png"), full_page=True)
        page.get_by_role("button", name="02 Accuracy lab").click()
        page.locator(".sensitivity-values").wait_for()
        page.screenshot(path=str(ROOT / "screenshots/analysis-desktop.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        page.get_by_role("button", name="01 Decision replay").click()
        page.locator(".run-list strong").wait_for()
        page.screenshot(path=str(ROOT / "screenshots/replay-mobile.png"), full_page=True)
        page.get_by_role("button", name="03 Data & method").click()
        page.locator(".source-list").wait_for()
        page.screenshot(path=str(ROOT / "screenshots/method-mobile.png"), full_page=True)
        browser.close()
finally:
    p.terminate()
    p.wait()
