# iPhone Safari: 3D scene becomes blurry, then clears after replay

Date: 2026-10-28, Asia/Taipei. Intended executor: the same Codex model at Light reasoning.

Project root: `C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D`.
Inspected revision: `main`, `4aa54de32662d72f27fd4185effe35778f4de2e0`.
Observed public origin: `https://bouquetforyou.lar-ykt.com/`.

## Diagnosis and phase readiness

**CONFIRMED:** the current local viewer can lower its entire 3D drawing buffer below CSS resolution. Replaying restores the original drawing-buffer size through Canvas reconfiguration while the economy flag remains set. This was reproduced in a browser, and the public viewer asset contains the same DPR cap and downgrade expression.

**LIKELY:** this explains the owner's specific iPhone Safari incident. The owner reports that only flowers, bouquet, frames and other 3D objects became blurry, and that the animation reset button cleared it. No exact private link, iPhone model, iOS version, or physical-device measurements were supplied. Desktop Chromium with emulated mobile dimensions does not establish Safari GPU behavior.

| Phase | Readiness | Boundary |
| --- | --- | --- |
| D0: recheck target and reproduce the known DPR bug | READY FOR DIAGNOSIS | Read-only runtime checks and synthetic local inputs |
| S1–S3: correct the confirmed DPR ownership bug | READY, conditional on D0 reproducing current code | Execute only under a later request to implement; this invocation is diagnosis/planning only |
| D1: associate the exact iPhone symptom with the mechanism | READY FOR DIAGNOSIS when device/input is available | Required before claiming the original Safari case is verified resolved |
| Any extra Safari-specific rendering fix | BLOCKED | Requires D1 evidence inconsistent with, or remaining after, this bounded correction |
| Production publication | NOT AUTHORIZED by this debug-plan request | Separate explicit publishing authorization; no database/API changes are needed |

This plan is ready for the established local defect, not a claim that the unimplemented correction has passed or that Safari is already fixed. D0 is a real diagnosis gate: if current code no longer reproduces the defect, do not apply the patch automatically.

Progress:

- [x] Trace short-link decoding, recipient rendering, quality policy and replay.
- [x] Reproduce low DPR and replay restoration with synthetic content.
- [x] Read public frontend assets without reading a private gift or writing production data.
- [x] Save diagnosis and proposed handoff; application code remains unmodified by this investigation.
- [x] D0: executor preflight and regression baseline; failed at render scale 0.59945 as expected.
- [x] S1: remove the conflicting imperative DPR owner (owner authorized implementation with “proceed”).
- [x] S2: add focused browser regression coverage; 3 cases passed.
- [x] S3: run scoped checks and write actual verification results; see `../verification/2026-10-28-viewer-resolution.md` for host timing limits and unrun extra visual/export sweeps.
- [ ] D1: verify the original case on physical iPhone Safari.
- [ ] Publish only under separate authorization, then repeat device acceptance.

## Problem and expected outcome

Original trigger, from owner: open a shortened bouquet URL on an iPhone using Safari. The 3D flowers, bouquet, frame and other objects become blurry/aliased. The owner subsequently clarified that the animation reset button fixes it. Text and other page UI were not reported blurry. Frequency, time until blur, page zoom, exact button identity, device model and iOS version are not known. Treat the recipient's `Replay effects` button as the primary interpretation; `Reset view` is a separate camera action and must also be checked.

Expected: the scene should retain its configured drawing-buffer resolution when performance fallback engages, and replay should not unexpectedly make the scene sharper. Existing motion, interactions, gift contents and saving must continue to work. This bounded fix preserves the existing 1–1.25 render-scale budget; it does not promise native Retina resolution or perfect edges at extreme zoom.

## Reason behind the issue

The app uses two independent controls for the same render resolution. Canvas declares one resolution, while the slowdown code directly sets a smaller one. A replay causes Canvas to reapply its declaration. The result is a scene that can become soft on its own and sharpen after a button press even though the stored gift has not changed.

The observed chain is:

1. `#s=<code>` loads a serialized configuration through `openSharedBouquet`; `decode(payload)` reconstructs the gift. The recipient opens the gift and mounts the shared `Viewer`.
2. `Viewer` declares `<Canvas frameloop="demand" dpr={[1, 1.25]}>`. On the diagnostic DPR-3 viewport, initial actual DPR was 1.25.
3. `Scene` accumulates delivered frame intervals. After more than two seconds of samples, below 32 FPS selects quality 1; below 20 selects quality 2.
4. A higher quality-number calls `setDpr`. For a scene narrower than 500 CSS pixels, quality 1 uses 0.8 and quality 2 uses 0.6. Quality numbers only increase. The browser stretches that small buffer over the full visible stage, reducing detail on all meshes, including frames and toys. The DOM text is rendered separately.
5. `Replay effects` changes React state (`replay`). The replay effect itself only resets animation time, but the Viewer/Canvas render also runs React Three Fiber's configure path. In installed Fiber 9.8.1 it compares the live DPR with the declared Canvas DPR and reasserts the declaration when they differ.
6. In the diagnostic, replay changed actual DPR from 0.6 back to 1.25 while `economy` remained true. With quality already 2, the one-way condition cannot apply that same downgrade again. Thus the quality counter and actual resolution can disagree.

This accounts for the reported recovery, which a simple claim of permanently reduced resolution would miss. Native antialiasing was enabled and active in the local reproduction (4 samples). Antialiasing cannot supply the detail lost by rendering an entire scene at 0.6 CSS pixels per CSS pixel.

The proposed correction removes only the competing imperative DPR writer. Canvas remains the single owner. Existing cheaper materials and slower animation cadence remain available under load. Do not solve this by refreshing the page, replaying automatically, or remounting Canvas; those hide the disagreement and can disturb interaction state.

## Evidence and competing explanations

Paths below are relative to the explicit project root unless absolute.

| ID | Source/check | Observation | Meaning and limits |
| --- | --- | --- | --- |
| E1 | Owner's report and clarification on 2026-10-28 | Only 3D objects blur; animation reset clears it | Strong match to a scene-wide render-state change, not proof of the underlying Safari state |
| E2 | `src/Viewer.tsx:23, 127–135, 211`, `Scene`, `Viewer` | Canvas DPR 1–1.25; slow frames imperatively select 0.8/0.6 on narrow scenes | Direct source evidence of below-CSS rendering and competing owners |
| E3 | `src/Viewer.tsx:80`; `src/App.tsx`, recipient `Replay effects` handler and `Viewer` call | Replay increments a prop and resets elapsed time; no explicit resolution reset | Explains why tracing only the replay effect is insufficient |
| E4 | `node_modules/@react-three/fiber/dist/react-three-fiber.esm.js:78–138`; `events-9ce18a08.esm.js:124–130, 1115–1123, 1184–1203, 1522` | Canvas configures after render; configure reasserts declared DPR; store updates renderer size | Version-matched dependency evidence for replay's indirect resolution reset |
| E5 | `src/sharing.ts:40–50`; `src/App.tsx`, `initialState`, hashchange listener and recipient Viewer | Short and portable URLs resolve to configuration and the same Viewer | No separate compressed-picture renderer for short URLs; does not prove the exact supplied gift's contents because its URL is unavailable |
| E6 | `.checks/safari-blur-diagnostic.mjs` and `.checks/safari-blur-diagnostic/results.json` | Local synthetic short gift went 1.25 → 0.6 → 1.25 after replay | Confirmed runtime mechanism in Chromium/SwiftShader, not physical Safari |
| E7 | Same diagnostic, native context attributes | `antialias: true`, `SAMPLES: 4`, `visualViewport.scale: 1` | Rules out missing MSAA and page pinch zoom for this local reproduction only |
| E8 | Read-only GET of live homepage and `https://bouquetforyou.lar-ykt.com/assets/Viewer-D7Lvpp1t.js` | HTTP 200; asset includes `dpr:[1,1.25]` and `V(vn===2?gn?.6:.75:gn?.8:1)` | Current public bundle has the relevant faulty policy. Asset hash may change; rediscover through homepage next time |
| E9 | `src/objectPhotos.ts:12–30`; `src/giftCatalog.ts:38` | Uploaded photos are separately reduced to at most 320 pixels on the longest side, then JPEG-limited; frame texture is 320 or 400 pixels wide | Possible residual photo-detail limit. Cannot explain all mesh silhouettes sharpening on replay; do not change photo contracts in this task |
| E10 | `git diff c3978a3^ c3978a3 -- src/Viewer.tsx` | Empty viewer diff for short-link implementation commit | No direct Viewer edit in that commit; dependency/configuration changes mean this is not proof of when the defect originated |

### Exact local runtime result

PowerShell, project root: `node .checks/safari-blur-diagnostic.mjs`.
The diagnostic starts and closes its own Vite server on port 5185, uses a synthetic starter gift plus a Memory Frame and Cuddle Teddy, and intercepts GET `/api/bouquets/Abcdef012345_-XY` with an encoded synthetic payload. It makes no share POST and creates no saved gift. It uses the installed Playwright Chromium executable at `C:/Users/user/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe`.

Environment: Chromium, SwiftShader software GPU, viewport 390×844 CSS pixels, emulated DPR 3. The stage measured 362×340 CSS pixels. No physical-device FPS conclusions can be drawn from the following software-renderer timings.

| State | Actual DPR | Buffer size | Economy | Observed sampled FPS |
| --- | --- | --- | --- | --- |
| Short gift, reduced motion | 1.25 | 452×425 | false | 0; no animated measurement |
| Motion enabled, sampled after 8 seconds | 0.6 | 217×204 | true | 11.07 |
| After Replay effects | 1.25 | 452×425 | true | 8.52 |
| After subsequent Reset view | 1.25 | 452×425 | true | 8.83 |
| After subsequent Pause motion | 1.25 | 452×425 | true | last animated window 8.38 |
| Portable gift, reduced motion | 1.25 | 452×425 | false | 0 |

The standalone effect of Reset view while DPR is 0.6 was not tested; its row follows replay. The portable route was checked only at initial reduced-motion resolution, not through the full animated downgrade/replay sequence. The future regression must cover both.

Inspected images: `.checks/safari-blur-diagnostic/short-animated-8s.png` and `short-after-replay.png`. The former has visibly softer silhouettes and details; DOM overlays remain sharp. Positions differ because animation continues; these are not pixel-identical image comparisons. JSON metrics establish the resolution change.

Initial attempts using a separate server process failed with `ERR_NETWORK_ACCESS_DENIED`/`ERR_CONNECTION_TIMED_OUT`; the combined temporary server/browser diagnostic succeeded with exit 0. These are diagnostic-host limitations, not bouquet failures. No full unit/build suite was run during planning.

| Hypothesis | Discriminating evidence | Conclusion |
| --- | --- | --- |
| Below-CSS DPR plus Canvas reconfiguration | Buffer dimensions, DPR and quality before blur/replay | Confirmed local; same policy present live; likely exact incident |
| Short URL loses mesh/image quality | Same decoded config and shared Viewer; geometry is generated locally | No evidence for this explanation |
| Missing native antialiasing | Existing WebGL context attributes and sample count | Falsified for local reproduction; still inspect physical device if symptoms remain |
| Uploaded photo compression | Only photo interiors stay soft while mesh edges remain clear | Separate potential limitation, not primary all-object failure |
| Safari viewport/compositor sizing | On-device canvas ratio, viewport scale and screen recording with unchanged DPR | Unresolved fallback hypothesis if D1 fails to match DPR mechanism |

## Context and boundaries

Installed versions observed: Three.js 0.180.0, Fiber 9.8.1, Drei 10.7.9, Playwright 1.63.0, Vite 7.3.6; diagnostic Node 24.18.0. Trust the current lockfile and installed implementation over examples for another release. No dependency upgrade is needed.

Instructions: the owner supplied AGENTS instructions apply; no project/ancestor AGENTS.md was found in the checked local hierarchy. Vault instructions were read and ATLAS project context loaded. No reusable knowledge note is needed for this routine diagnosis. Do not turn this into automation/n8n work.

The tree was initially clean. Other changes appeared during the investigation, made outside this task: `src/App.tsx`, `tests/browser/app.spec.ts`, `envelopes.spec.ts`, `filler-arrangement.spec.ts`, `flower-arrangement.spec.ts`, `frames.spec.ts`, `live-flower-editor.spec.ts`, `objects.spec.ts`, `shareHelpers.ts`, `sharing-errors.spec.ts`, `studio.spec.ts`, plus untracked `tests/browser/shared-logo.spec.ts`. The inspected App diff concerns the shared gift logo/remix flow. Preserve all of it. `src/Viewer.tsx` still has no diff. Recheck the complete working tree before execution; this list can drift.

Primary guidance consulted, as supplemental explanation rather than proof of installed behavior:

- [Three.js responsive canvas and display resolution](https://threejs.org/manual/pages/responsive.html).
- [React Three Fiber scaling performance and on-demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

Must have:

- One DPR owner: Canvas. No frame-quality path writes a lower DPR.
- At the same stage size and browser DPR, performance fallback and replay leave drawing-buffer dimensions unchanged, apart from integer rounding.
- Existing `economy` fallback still activates under sustained slow frames; animation cadence/material fallback remains.
- Both mocked-short and portable recipients keep the same resolution before and after replay.

Must preserve: current gift cover, current logo/remix edits, arrangement, object/frame state, photos/crops, envelope behavior, camera controls, reduced motion, pause/replay, demand rendering, context-loss fallback and PNG export. Preserve all share contracts and existing saved links.

Must not have: storage resets, new share POSTs to production for testing, API/D1/schema changes, photo-budget changes, replacing materials globally, added postprocessing/dependencies, forced native DPR 3, new user controls, automatic refresh/remount/replay, or changes under `project-demo`.

## Diagnosis gates

### D0 — Recheck the established mechanism before implementing

- **Depends on:** a later implementation request; none is granted by this artifact itself.
- **Target/preflight:** `Scene` quality branch and Canvas declaration in `src/Viewer.tsx`; installed Fiber configure behavior. Capture current `git status --short` and task-relevant diff. Preserve the concurrent changes listed above.
- **Action:** rerun the temporary diagnostic if still available, or execute S2's new synthetic browser test against the old Viewer before S1. Read the diagnostic script first. It uses no production write. If port 5185 is occupied, choose another unused loopback port consistently in that temporary diagnostic, without killing an unrelated process. If the recorded Chromium binary is absent, use Playwright's current installed executable rather than installing/upgrading dependencies by default.
- **Expected:** motion triggers economy plus actual DPR below 1; replay restores configured DPR. The S2 invariant test should fail at the degraded DPR assertion before S1.
- **Gate:** if source and runtime agree with E2/E4/E6, S1–S3 may proceed under implementation authorization. If DPR never degrades, first verify that motion is enabled, the scene is visible and the test drives sustained sub-20-FPS frames. Do not mistake a fixture/timing failure for a falsified mechanism. If the relevant policy no longer exists or a bounded reproduction still contradicts it, stop S1 and revise diagnosis.

### D1 — Physical iPhone Safari association and acceptance

- **Target:** owner's affected shortened URL in Safari, with the exact iPhone model/iOS version recorded when supplied. Do not copy private gift payloads/photos into reports.
- **Action:** open the gift fresh, tap to open, observe for at least 15 seconds, rotate/zoom the 3D scene, then press Replay effects. Check Reset view in a separate fresh run, not only after replay. Record whether the blur affects silhouettes or only photo interiors.
- **Optional read-only Safari Web Inspector measurement:** run this complete console expression before blur, during blur and after replay. No production debug endpoint is required:

```js
(() => {
  const canvas = document.querySelector('.gift-scene canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return { error: 'Gift canvas not mounted' };
  const rect = canvas.getBoundingClientRect();
  const gl = canvas.getContext('webgl2');
  return {
    browserDpr: window.devicePixelRatio,
    cssWidth: rect.width, cssHeight: rect.height,
    bufferWidth: canvas.width, bufferHeight: canvas.height,
    renderScale: rect.width ? canvas.width / rect.width : null,
    viewportScale: window.visualViewport?.scale,
    antialias: gl?.getContextAttributes()?.antialias,
    samples: gl ? gl.getParameter(gl.SAMPLES) : null,
    hidden: document.hidden
  };
})();
```

- **Interpretation:** below-1 render scale during blur, then approximately 1.25 after replay at unchanged CSS size/page zoom, confirms association. If render scale stays unchanged while all objects visibly sharpen, the exact Safari symptom remains unresolved; investigate viewport/compositor invalidation next and do not broaden S1 speculatively. If only photo interiors remain soft, treat compression as a distinct issue requiring its own scoped decision.
- **Access limit:** this Windows session has no physical iPhone Safari inspection. If remote inspection is unavailable, a device recording can support symptom matching but cannot prove DPR. Do not hold the independently confirmed local correction behind a device-access requirement; do hold the claim of physical Safari resolution.

## File and resource change map

| Step | Resource | Operation | Stable anchor | Correction |
| --- | --- | --- | --- | --- |
| S1 | `src/Viewer.tsx` | Modify | `Scene` useThree destructuring; `if (target > fps.current.quality)` | Remove `setDpr` subscription and quality-branch call; leave Canvas range intact |
| S2 | `tests/browser/viewer-resolution.spec.ts` | Create | New focused synthetic recipient suite | Assert stable drawing-buffer resolution under slow frames, replay and pause for both link forms |
| S3 | `docs/verification/2026-10-28-viewer-resolution.md` | Create | Actual results and environment | Record baseline/fixed tests, device limits and eventual acceptance |
| D1 | Owner's iPhone Safari | Read/interaction | Exact affected gift, when provided | Verify original symptom without modifying the saved gift |

No sharing API, database, configuration, dependency, stylesheet or export code change is planned.

## Ordered fix steps

### S1 — Make Canvas the sole resolution owner

- **Depends on:** D0 and a later implementation request.
- **Preflight:** Canvas is still `dpr={[1, 1.25]}` and the quality branch still selects `.6/.75/.8/1`. If materially different, stop and re-evaluate.
- **Action:** apply the following complete two-hunk proposed patch. It is unimplemented and unverified as a fix. No imports, props, exports or other callers change.

```diff
--- a/src/Viewer.tsx
+++ b/src/Viewer.tsx
@@
-  const { gl, scene, camera, size, invalidate, setDpr } = useThree();
+  const { gl, scene, camera, size, invalidate } = useThree();
@@
-        if (target > fps.current.quality) { fps.current.quality = target; design?.lowerQuality(); effects?.lowerQuality(); setDpr(target === 2 ? (low ? .6 : .75) : low ? .8 : 1); }
+        if (target > fps.current.quality) { fps.current.quality = target; design?.lowerQuality(); effects?.lowerQuality(); }
```

- Add a concise comment immediately above the quality branch: `// Keep resolution owned by Canvas; economy mode changes materials and cadence.`
- **Expected:** economy engages without changing drawing-buffer resolution; replay resets animation without an incidental sharpness change. `low` remains needed for effect construction, so do not remove it.
- **Verify:** S2, typecheck and focused lint. At unchanged stage size/DPR the before/after measured scale stays at the configured cap (1.25 on DPR 3), not 0.6/0.8. Do not change the range to 1.5/2/3 within this patch: increasing the pixel workload requires separate device evidence.
- **If it fails:** inspect actual buffer dimensions and remaining `setDpr`/`setPixelRatio` writers. Do not add a second effect that continually forces DPR back. Stop if another owner is found rather than masking a race.

### S2 — Add a regression that reaches the failure condition

- **Depends on:** D0 for a before-fix run; S1 for a passing run.
- **Target:** new `tests/browser/viewer-resolution.spec.ts`; do not alter concurrent existing test changes.
- **Action:** implement the suite with these exact contracts (test-fixture algorithm; assertions below are normative):
  1. Import `test`, `expect` from `@playwright/test`, `clone`, `encode`, `starter` from `../../src/config`, and `createGiftObject` from `../../src/giftCatalog`.
  2. Use `test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })`. Set each test timeout to 90000 to accommodate software GPU hosts.
  3. Run one independent test per link kind, `short` and `portable`. Build `clone(starter)` and append `createGiftObject('standing-frame', config.objects)` followed by `createGiftObject('teddy-bear', config.objects)`. Encode it once. Mock only GET `**/api/bouquets/Abcdef012345_-XY` with HTTP 200 JSON `{ payload }`; use `/#s=Abcdef012345_-XY` or `/#b=${payload}`. Do not call Share bouquet or write a saved gift.
  4. Install the complete init script below before navigation. Its only purpose is controlled slow frame delivery. The busy wait is test-only and must never enter application code. It preserves the native request ID and cancellation path.

```ts
await page.addInitScript(() => {
  const diagnostic = window as unknown as { __resolutionSlowFrames: boolean };
  diagnostic.__resolutionSlowFrames = false;
  const request = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => request(() => {
    if (diagnostic.__resolutionSlowFrames) {
      const until = performance.now() + 75;
      while (performance.now() < until) { /* Simulate sustained frame pressure. */ }
    }
    callback(performance.now());
  });
});
```

  5. Tap `getByRole('button', { name: 'Tap to open', exact: true })`. Wait for the existing dev-only `window.__petalpopMetrics` to return non-null and frames > 1. A production bundle intentionally lacks this hook; this regression uses the dev webServer from `playwright.config.ts`.
  6. Use the complete snapshot function below. Wait for nonzero canvas dimensions; record initial snapshot and a stage screenshot. Initial ratio must be within 0.01 of 1.25 and `economy` false.

```ts
const snapshot = () => page.evaluate(() => {
  type Metrics = { pixelRatio: number; economy: boolean; frames: number; calls: number; triangles: number };
  const debug = window as unknown as { __petalpopMetrics?: () => Metrics | undefined };
  const canvas = document.querySelector('.gift-scene canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing gift canvas');
  const rect = canvas.getBoundingClientRect();
  const metrics = debug.__petalpopMetrics?.();
  if (!metrics || !rect.width || !rect.height) throw new Error('Viewer not ready');
  return { metrics, width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height, ratio: canvas.width / rect.width };
});
```

  7. Set `__resolutionSlowFrames = true` using `page.evaluate`, then `page.emulateMedia({ reducedMotion: 'no-preference' })`. Use `expect.poll` with timeout 30000 to wait for `economy === true`. Do not accept merely waiting a fixed number of seconds without establishing fallback.
  8. Save the degraded-state snapshot. Assert CSS dimensions equal initial dimensions, buffer width/height equal initial width/height, actual `pixelRatio` equals initial `pixelRatio`, and ratio is at least 1. The old code should fail here, typically at DPR 0.6. Record the actual baseline; it has not been run as this new test yet.
  9. Tap `Replay effects`, then wait until `metrics.frames` increases by at least 3. Assert DPR, CSS and buffer dimensions still equal initial; `economy` remains true. Repeat for `Reset view`, then `Pause motion`, allowing pending transition frames to settle. Save snapshots at each stage. Replay changing only positions/effect timing is expected.
  10. Disable the test slow-frame flag. Preserve media reduce coverage in a separate fresh recipient open: with `reducedMotion: 'reduce'`, assert initial configured resolution and the disabled Pause motion control. No economy transition is expected there.
  11. Test width 760 once with motion enabled/forced slow frames to cover the non-narrow branch that previously used 0.75. Establish a new initial baseline after resizing before checking stability. Rotation/resizing can legitimately change buffer dimensions; compare only at identical CSS size.
- **Expected:** the test detects the old real contract failure and passes after S1, while the fallback still demonstrably activates. It does not assert a physical-device FPS target or compare moving screenshots pixel-for-pixel.
- **Verify:** scoped Playwright command under S3. If a fixture cannot reach economy, inspect visibility, motion media and the slow-frame flag; stop at a fixture failure without weakening the resolution assertion.

### S3 — Verify the correction and preserve an honest handoff

- **Depends on:** S1 and S2.
- **Shell/cwd:** PowerShell, project root. Commands below are planned, not already passed.

```powershell
npm.cmd run test -- --reporter=dot
npm.cmd run build
npx.cmd eslint src/Viewer.tsx tests/browser/viewer-resolution.spec.ts
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\user\AppData\Local\ms-playwright'
npx.cmd playwright test tests/browser/viewer-resolution.spec.ts --project=chromium
npx.cmd playwright test tests/browser/app.spec.ts --project=chromium --grep 'maximum bouquet|camera rotation|reduced motion'
git diff --check
git status --short
```

- The browser-cache environment variable is a local test-runner setting; this project is not n8n. Restore its previous value after the test session if it existed. Do not install missing browsers silently or change package versions to make the recorded path work.
- The standard browser config uses port 5180. Inspect any existing server before reusing it. If sandbox networking fails, keep server and browser in one approved local process as the successful diagnostic did, or report the host blocker. Do not infer test success from a blocked navigation.
- Full lint previously had `project-demo` findings according to the dated sharing report; that was not re-run in this invocation. Run focused lint for this task, and distinguish any current broader findings rather than claiming a fresh full-lint pass.
- **Expected:** unit/build/focused lint and applicable browser checks exit 0; resolution regression reaches economy and remains at configured DPR; camera/reset/reduced-motion and bounded draw-call/triangle checks continue to pass. The maximum-bouquet performance test contains only geometry/draw-call limits, not a phone FPS promise.
- **Manual rendered checks:** recipient at 390×844/DPR 3, narrow 320 portrait, 760-wide and desktop 1280; motion on/off, rotate/zoom/reset/replay, both link forms, frame and teddy edges, and one PNG export. Existing export is 1080 square and separate from on-screen DPR; verify output still exists without altering its renderer target.
- **Physical check:** D1 on the owner's Safari case before declaring that case resolved. If local checks pass but iPhone still blurs without a buffer-ratio change, report the remaining Safari issue and keep further patches blocked pending new evidence.
- **Report:** create `docs/verification/2026-10-28-viewer-resolution.md` with actual baseline/fixed results, screenshots, environments and remaining limits. Update this plan's checklist. No commit, push or deployment is implied.
- **If it fails:** diagnose only the failing scoped check; do not loosen assertions or expand into unrelated tests/features. Preserve concurrent App/test edits.

## Regression and acceptance matrix

| Scenario | Before evidence | Planned acceptance | Protects |
| --- | --- | --- | --- |
| 390px, DPR 3, short gift, sustained slow frames | Local actual DPR 0.6 and visible blur | Economy true, stable configured buffer/DPR >= 1 | Original failure mechanism |
| Replay after fallback | Local DPR 0.6 → 1.25, economy stays true | No incidental resolution change | Conflicting DPR ownership |
| Portable gift under same pressure | Initial 1.25 observed; animated sequence unrun | Same invariant as short route | Shared Viewer consumer |
| 760-wide scene | Source branch selects 0.75; runtime unrun | Buffer remains at its baseline | Non-narrow quality branch |
| Reduced motion | Local initial 1.25/economy false | Static stable scene, motion control disabled | Accessibility and idle rendering |
| Camera orbit/zoom, reset and stage resize | Existing tests inspected, not rerun | Controls work; compare buffers only at same CSS size | Interaction/framing |
| Maximum bouquet with effects | Existing test inspected, not rerun | Existing draw-call/triangle bounds pass; no resolution collapse | Performance fallback remains available |
| Frame/photo and teddy | Synthetic frame/teddy visibly soften with whole scene | Stable mesh-edge clarity; retain existing photo budget | Object layer integration |
| PNG export | Separate 1080 render target inspected, unrun | Export still works with intact content | Consumer independent of screen DPR |
| Exact physical Safari gift | Owner symptom/replay recovery only | No automatic all-object blur after 15 seconds/interactions; no replay needed | Original incident; pending |

## Recovery, stop conditions and limits

S1 is limited to two existing lines plus a comment; S2/S3 create new task-owned files. Revert only those exact hunks/new files if necessary after checking current diffs. Never use a whole-tree reset/checkout to recover this task; the shared logo/remix work must survive. Do not touch `.data`, saved payloads, D1, production routes or private photos.

Stop dependent work on materially changed Viewer policy, unresolved D0 reproduction, an undiscovered DPR owner, required checks failing without a scoped cause, or a need for production writes without explicit authorization. A lack of physical Safari access limits the acceptance claim, not the demonstrated local bug. Keeping the existing DPR cap can leave baseline softness on a high-density screen; any later cap increase must be measured separately for visual benefit and device cost.

The temporary diagnostic files under ignored `.checks/safari-blur-diagnostic*` are useful local evidence, not deployed code or guaranteed persistent artifacts. Their essential results are recorded here. This plan is the only deliverable intended for version control from this invocation.

## Copy-ready executor prompt

```text
Implement the confirmed viewer DPR correction described in:
C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D\docs\plans\2026-10-28-iphone-safari-3d-blur-debug-plan.md

Project:
C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D

Read the entire plan and current applicable AGENTS instructions first. Honor current human authorization; the saved plan alone does not authorize implementation or publication. This prompt is intended for a later explicitly requested fix, using the same model at Light reasoning.

Inspect git status/diffs and the current Viewer/Fiber contracts. Preserve concurrent App/shared-logo/remix and browser-test edits listed in the plan, plus any newer edits. Complete D0 before applying S1. If the source/runtime no longer supports the DPR ownership mechanism, stop the dependent patch and report the observations.

For the confirmed mechanism, follow S1–S3 in order. Make Canvas the single DPR owner by removing Scene's setDpr destructuring/call; preserve the existing 1–1.25 Canvas DPR cap, materials/cadence fallback and all gift/share/export/interaction behavior. Add only the focused synthetic browser regression and verification report specified. Do not add postprocessing, raise resolution, alter photo budgets, remount Canvas, or modify any API/database/dependency to fix this issue.

Run the regression before and after the patch where practical and record actual results. Establish that economy fallback activates, rather than weakening assertions when the fixture is not slow. Run the scoped commands/render checks in S3 and maintain the progress checklist. Stop for material drift, host blockers or failed checkpoints without a scoped diagnosis.

Run D1 when the exact iPhone/input is available. Local Chromium/SwiftShader and matching live JavaScript do not prove physical Safari acceptance. If Safari still sharpens after replay without a buffer-ratio change, report the remaining issue and investigate before any extra patch. Do not block the independently confirmed local correction solely on missing physical-device access, but do not claim the original Safari case is verified fixed.

No production POST, saved-gift mutation, schema operation, publishing, commit or push is authorized by this artifact. External writes require explicit current authorization. Recover only task-owned hunks/files and preserve all user changes/data. Report changed files, actual original-trigger/regression results, remaining device evidence limits and incomplete phases.
```
