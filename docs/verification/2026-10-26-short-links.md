# Short bouquet links: implementation verification

Date: 2026-10-26, Asia/Taipei.

## Result and scope

Implemented locally: short-only creation, explicit failure/Retry, latest-config guards, a Cloudflare Worker API and durable D1 snapshots. Successful links at `https://bouquetforyou.lar-ykt.com/` measure **53 characters**, including gifts with embedded photos. Existing compressed and legacy portable links remain readable. No application schema or photo compression change was made.

The public site was **not deployed or changed**. Read-only production requests established the immediate hosting defect: `/api/bouquets` responds with 200 `text/html` and the homepage document, rather than API JSON. The old creator catches this failure and puts the complete gift in its URL. The supplied example measured 43,663 characters; private content is not copied into this report.

## Changes

- `src/sharing.ts`: typed save errors, media type/response validation, cancellation/deadline handling, no automatic portable URL creation.
- `src/App.tsx`: ready/error state tied to the current config, disabled copy/native actions until saved, explicit Retry, preserved text editing and clipboard fallback. Existing styles and spacing are reused.
- `cloudflare/worker.ts`: bounded streamed JSON input, origin/method checks, controlled JSON errors and readiness that checks D1 schema. Response/logging paths omit gift content. Default URL invocation logging and traces are disabled in the Worker configuration.
- `cloudflare/shareStore.ts` and migration: immutable payloads and cryptographic codes, atomic concurrent deduplication/capacity, persisted rolling-hour rate limits, integrity checks on existing deduplicated snapshots and reads.
- `cloudflare/wrangler.jsonc`, generated types and isolated compiler config: local-only binding with pinned Wrangler 4.152.0. No production account, database UUID or route is configured.
- `src/notes.ts`: `appendChild` replaces a DOM `append` call because generated Cloudflare HTMLRewriter types also declare `Element.append`. The DOM behavior is preserved; this resolves the shared imported module's compiler collision without handwritten runtime types or weakening checking.
- Sharing unit/browser tests and five existing fallback-dependent scenarios now expect explicit failure. Legacy portable fixtures are created directly for reader regression coverage.
- README and deployment handoff describe actual behavior and separate local verification from activation.

## Observed checks

All commands ran from `C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D`.

| Check | Observed result |
| --- | --- |
| `npm.cmd test -- --no-file-parallelism --testTimeout=20000` | **135/135 tests passed, 12/12 files** |
| `npm.cmd test -- tests/sharing.test.ts --no-file-parallelism --testTimeout=20000` | **18/18 passed** |
| `npm.cmd run build` | Passed, including TypeScript and Vite production bundle |
| `npm.cmd run cf:types` | Generated types with workerd 1.20261019.1 and the actual binding |
| `npm.cmd run cf:typecheck` | Passed |
| Worker dry-run bundling | Passed; approximately 455 KiB uncompressed / 88 KiB gzip; no runtime filesystem store required |
| `npm.cmd run test:cf-sharing` | **10/10 local API/persistence checks passed**; includes actual workerd and persistent D1, not a mock store |
| Focused ESLint on `src`, `server`, `tests`, new Worker/store/harness/config | Passed |
| Repository-wide ESLint JSON report | **8,318 errors and 126 warnings in 72 files**, all within the untouched `project-demo` tree after generated output exclusions. No findings outside that tree. Whole-repository lint is not green. |
| `git diff --check` | Passed; Git emitted only normal existing line-ending conversion notices |

### Browser evidence

Seven affected regressions passed together (7/7) using the existing Chromium/SwiftShader configuration:

```powershell
npm.cmd exec playwright -- test tests/browser/studio.spec.ts tests/browser/flower-arrangement.spec.ts tests/browser/filler-arrangement.spec.ts tests/browser/live-flower-editor.spec.ts tests/browser/surprise-studio.spec.ts tests/browser/app.spec.ts -g 'failed services|stem visibility|filler settings survive|bulk height survives|surprise preserves|shared URLs reconstruct|sharing title'
```

These cover fresh-recipient draft isolation until Remix, synchronized title/body/native sharing, flower/filler arrangement settings, legacy portable round trips, PNG output and preserved surprise photos/envelope notes.

The four additional scenarios in `playwright.sharing.config.ts` were verified across final runs:

1. Failure/Retry, preserved edits, empty link and disabled copy/native actions; responsive error screenshots at 320×844, 390×844 and 1280×960. The final Retry button spacing was checked in a targeted rerun.
2. HTTP 429/413, HTML success and timeout all settle as controlled errors; closing/reopening retries.
3. Controlled response gates prove old responses cannot replace the current saved link; native sharing uses the latest title/body; clipboard denial selects the current URL. Final targeted rerun passed with the Retry scenario (2/2).
4. The real local Worker saves two actual canvas-generated JPEGs, crops, frame orientations and a formatted envelope note. A separate browser context retrieves and renders them, opens its note, and preserves an empty local draft until Remix; legacy portable opening still works. This passed in the last full focused run.

The last full four-scenario run reported three passes and one timing-sensitive test assertion; that assertion depended on observing a brief debounce interval. It was replaced with explicit held network responses, then both affected scenarios passed. Do not describe the earlier failed run as green or combine outputs into a fabricated single-suite result.

Screenshots personally inspected:

- `artifacts/sharing/error-320.png`: complete usable error/Retry controls within a scrolling native dialog, no horizontal overflow.
- `artifacts/sharing/error-1280.png`: error/Retry and disabled actions retain the existing dialog layout.
- `artifacts/sharing/worker-recipient.png`: saved photo frames and envelope rendered with the gift.

The 390px screenshot is also retained. Existing tracked screenshots rewritten by other regression tests were restored from their inspected HEAD blobs; only the new task-specific screenshot directory is retained as evidence.

### Backend scenarios

The ten checks exercise missing-schema 503, JSON readiness/headers, full normalized gift fidelity and 53-character URL, simultaneous identical-save deduplication, later-edit immutability, input/origin/method/code boundaries, declared and streamed 190,001-byte rejection, 120-request limit/121st rejection and persisted-window reset, atomic 100 MiB payload capacity under concurrent distinct writes, deduplication at capacity, corrupt snapshot failures, and retrieval after runtime disposal/restart on the same database files.

The storage fixture's small JPEG sentinel checks byte-for-byte persistence only. The browser fixture uses real canvas JPEGs and supplies the separate visual rendering evidence.

## Execution adjustments and earlier failures

- The initial sandbox could not resolve npm/public DNS and interfered with Vitest temporary SSR files and Wrangler runtime/log access. Approved local execution outside that sandbox completed installation and testing. No permission-review rejection remains unresolved.
- A geometry test exceeded its existing five-second timeout under concurrent CPU load. The complete suite passed with a command-line 20-second timeout; no geometry assertion or project test configuration was weakened.
- The persistence harness uses the Miniflare/workerd version shipped by pinned Wrangler, directly with its installed Miniflare 5 API, instead of spawning and killing a Wrangler server. This provides the actual runtime, local D1 access and disposal/restart verification with safe process cleanup. It accepts no target arguments and creates unique ignored test-state directories.
- Rate-limit tests make concurrent HTTP requests through the actual Worker. Passing Node-side prepared-statement proxy objects through large concurrent batches exposed an emulator proxy error; no production rate-limit logic was changed to accommodate it.
- Wrangler resolves the bundle output path relative to the configuration directory. The standalone check uses `../.checks/cloudflare/build`; the harness uses a verified absolute output path.
- Generated `.checks` and `.wrangler` trees are ignored by lint/Git, and generated runtime declarations are excluded from lint. Handwritten Worker code remains checked.
- Early browser fixture seeding was corrected to happen in a one-time init script after the original page's `pagehide` draft flush. The Remix assertion now waits safely for the existing asynchronous draft save. These were test harness corrections, not changes to recipient draft behavior.

## Production handoff and limitations

Wrangler authentication was verified read-only, and Pages/D1 inventories were read without mutation. The connected account's Pages list did not identify this site, and its D1 list was empty. The exact current frontend Worker and existing route/zone setup are still needed. Instructions for finding the name were provided to the owner.

Follow `docs/cloudflare-sharing-deployment.md` for resource names, pending remote actions, release order and preservation/rollback rules. No production D1 was created, no migrations ran remotely, no routes/DNS changed, no synthetic production gifts were written and no frontend/API deployment occurred. There is no commit or push from this work.

Browser checks are desktop Chromium with mobile viewport emulation and software graphics. Physical mobile devices, cross-network live recipients, production storage/latency, real retention/cost and deployed restart survival remain unverified. The local fix does not change the public domain until activated.

## Follow-up: production identity resolved

The owner supplied the Cloudflare Domains screenshot identifying `digital-boquet-3d`. Read-only deployment/version inspection confirmed this Worker, current version `b1119b92-c11f-4243-ad72-c4b159f1f8b8`, and a static-assets SPA configuration with no application bindings. `cloudflare/wrangler.frontend.jsonc` preserves that Worker/domain and passed `wrangler deploy --dry-run`, reading 101 frontend assets without publishing. The earlier identity limitation above is resolved; activation authorization and final overlapping-route checks remain pending. No remote resources or deployments were changed.

## Production activation completed 2026-10-27

After explicit owner authorization, the verified frontend Worker, dedicated API Worker, narrow domain route and D1 database were deployed. Seven live browser checks passed, including a full two-photo gift, note/arrangement fidelity, 53-character URL, controlled failure/Retry, fresh-recipient draft protection, legacy links and Remix. The synthetic saved payload remained identical after an API redeployment. See `2026-10-27-short-links-deployment.md` for exact resource/version IDs, screenshots and remaining device/network limits. Earlier “not deployed” statements above describe the original local implementation phase.
