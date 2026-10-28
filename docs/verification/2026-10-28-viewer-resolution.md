# Viewer resolution correction

Date: 2026-10-28, Asia/Taipei. Local implementation only; no publication, commit or push.

## Change

`src/Viewer.tsx` no longer calls `setDpr` from its slow-frame fallback. Canvas alone owns the existing DPR range of 1–1.25. Economy mode still reduces material cost and animation cadence. Share payloads, photos, API/storage and export code are unchanged.

The new `tests/browser/viewer-resolution.spec.ts` uses synthetic gifts and intercepted short-link GET responses. It deliberately slows frame delivery and establishes that economy mode activates before asserting stable buffer dimensions through replay, reset and pause. It covers short/portable links at 390px and the non-narrow branch at 760px, with emulated DPR 3. Initial reduced-motion behavior is checked in each case.

## Evidence

Before the patch, the new short-link/390px regression failed as intended: expected render scale >= 1, received `0.5994475138121547`. This confirms D0 against the current source before editing.

After the patch, all three cases passed. Actual DPR remained 1.25 at initial, economy fallback, replay, camera reset and pause. Buffer dimensions stayed 452×425 at the 390px viewport, and 900×475 at the 760px viewport. Economy changed from false to true without losing resolution.

Structured snapshots and screenshots are in `artifacts/viewer-resolution/`. The short-link 390px screenshot was visually inspected: bouquet, frame and teddy retain the configured detail while motion is paused. Existing maximum-bouquet checks refreshed `artifacts/maximum-mobile.png` and `artifacts/performance.json`.

## Checks actually run

PowerShell in `C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D`:

| Check | Result |
| --- | --- |
| New browser regression before patch, short/390px | Failed at sub-CSS resolution assertion, as expected |
| `node .checks/run-viewer-resolution.mjs viewer-resolution.spec.ts` after patch | 3 passed |
| Existing app checks via the same runner, grep `maximum bouquet\|camera rotation\|reduced motion` | 3 passed |
| `npm.cmd run build` | Passed TypeScript and Vite build, 2185 modules |
| `npx.cmd eslint src/Viewer.tsx tests/browser/viewer-resolution.spec.ts` | Passed after removing an unsafe optional-chain assertion from the new test's readiness wait |
| `git diff --check` | Passed; line-ending warnings only |
| `npm.cmd run test -- --reporter=dot --maxWorkers=1 --testTimeout=30000` | 135 tests passed, 12 files passed |

The default sandbox unit command could not load temporary SSR files (ENOENT). Outside that restriction, default five-second test budgets timed out in geometry-heavy existing tests: first run 133 passed/2 timed out, subsequent run 130 passed/5 timed out during other checks. The final run used a runner-only 30-second budget and passed every assertion. No test timeout configuration or existing assertion was changed. This is not a claim that the unmodified default command is green on this host.

Browser tests used installed Playwright Chromium, SwiftShader and emulated mobile properties, not iPhone Safari. The ignored temporary runner starts an isolated local Vite server at port 5185 and uses the existing installed browser cache; no production POSTs or saved-gift writes are involved in the new regression.

## Scope and remaining acceptance

Concurrent `App.tsx` shared-logo/remix changes, existing browser-test changes and their artifacts/report were preserved. Task source changes are limited to Viewer and the new regression. The detailed plan is `docs/plans/2026-10-28-iphone-safari-3d-blur-debug-plan.md`.

Physical Safari acceptance (D1) remains pending: open the affected gift, watch for at least 15 seconds, interact, and verify no all-object blur that requires replay. No physical iPhone, exact affected private URL or iOS version was available. Additional 320px/1280px visual sweeps and an explicit PNG download were not performed in this invocation. Existing browser tests cover camera/mobile pinch, reduced-motion/WebGL fallback and maximum-bouquet bounds; no physical-device FPS promise is made.

The existing DPR cap remains 1.25, so this correction prevents the additional automatic resolution collapse rather than promising native Retina detail. Production still requires a separately authorized publication before the phone can receive this change.
