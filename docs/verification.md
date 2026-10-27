# Verification record

27 October 2026, local private build.

## Observed passing

- A fresh isolated Python virtual environment installed the supplied requirements and passed all 26 tests.
- Python static unused/undefined-name checks (Ruff F) pass.
- TypeScript strict typecheck and Vite production compilation.
- 26 pytest cases, including Python domain, HTTP, snapshot integrity and all 31 delivery days at seven cutoffs.
- Six Playwright browser cases: replay/reveal, delayed-run provenance, analysis/sensitivity/methodology, 320/390/1440px overflow checks, network failure and retry, and a synthetic empty-coverage view.
- One-origin production-serving smoke test: health, built HTML and replay JSON from Python runtime.
- Independent numerical audit reproduces 744 pairs, MAE 2013.008064516129, bias 1729.9314516129032, RMSE 2505.943149370381 under the documented default assumptions.
- Production Node dependency audit: zero reported vulnerabilities at the time of check.
- Full-month analysis local microbenchmark: 10 runs, median 24.1ms and max 29.4ms. This is not a load, resource or service-level test.
- Actual rendered desktop decision, retrospective and analysis screenshots plus mobile replay and methodology. Checked readable chart axes/legends, hierarchy, controls, assumptions, source hashes and page width. No screenshot-based claim of full accessibility compliance.

## Remaining unverified or deferred

- Docker build/run: no supported builder/runtime executable or service socket available. Configuration and an unrun CI Docker smoke stage are included; not called validated.
- GitHub Actions: not run, as no repository was created/pushed.
- Vercel/Heroku deployment and free-plan compatibility: not attempted or promised. No deployed URL.
- YouTube demo recording/upload, public repository and form submission: explicitly deferred. Demo outline is a guide, not a video.
- Incognito access to submitted URLs: not relevant until authorized publication, and remains outstanding.
- WINDFOR within-hour semantics and real dissemination latency: unresolved. Two provisional join assumptions and availability-proxy caveat stay visible.
- Unit-level forecast/outturn fleet reconciliation: not established; official Elexon comparison supports the intended aggregate pairing.
- Container/Python 3.12 environment, cross-browser matrix, formal accessibility audit and production load/security review: not established by these checks.

## Non-failing warnings

The frontend's chart dependency creates a compressed production JavaScript payload of about 193KB; the initial single bundle exceeded Vite's advisory 500KB uncompressed threshold. Starlette's current httpx TestClient adapter emits a deprecation warning. Neither is hidden or treated as a passed security/load review.
