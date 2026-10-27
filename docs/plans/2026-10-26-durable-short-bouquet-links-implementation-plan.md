# Durable short bouquet links on Cloudflare

Date: 2026-10-26, Asia/Taipei.

**Execution COMPLETE on 2026-10-27:** S1–S9 implemented, deployed and verified after owner authorization. See `docs/verification/2026-10-27-short-links-deployment.md`. The original planning details below are retained as historical context.

- Project root: `C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D`
- Branch: `main`; inspected HEAD: `45e410cf5c7ad7620dacc20e46dd3ce0ed1cd7d9` (`Add individual filler arrangement controls and mobile workspace support`).
- Remote: `https://github.com/jaylarr/Digital-Boquet-3D.git`.
- Working tree was clean before planning. This plan is a new, task-owned file.
- Executor: same Codex model at Light/low reasoning, in a fresh chat if desired.
- Planning scope: inspect and write this handoff only. No application changes, dependency installation, resource provisioning, production POSTs, deployment, commits or pushes were performed.

## Execution update

Local implementation S1–S8 is complete. See `docs/verification/2026-10-26-short-links.md` for actual checks and `docs/cloudflare-sharing-deployment.md` for read-only account discovery and pending production activation. The owner subsequently authorized production activation. S9 was completed on 2026-10-27: the existing digital-boquet-3d frontend, API route and D1 database are deployed; seven live browser checks and post-redeployment payload persistence passed. See docs/verification/2026-10-27-short-links-deployment.md. Earlier planning boundaries below are historical, not the current release status. The Miniflare harness uses the pinned tooling’s actual local workerd/D1 APIs rather than spawning a Wrangler child; this keeps restart/persistence coverage and avoids process-tree cleanup.

## Progress

- [x] S1 Recheck source and establish baseline
- [x] S2 Make link creation short-only
- [x] S3 Add explicit sharing failure and retry states
- [x] S4 Add isolated Cloudflare local tooling and schema
- [x] S5 Implement the D1 snapshot store
- [x] S6 Implement the Worker API and local integration harness
- [x] S7 Update regression coverage, including old portable-link readers
- [x] S8 Complete local validation and deployment handoff
- [x] S9 Activate and verify the exact production resources — authorized and completed 2026-10-27

## Goal and observable outcome

The owner pasted a link generated on `https://bouquetforyou.lar-ykt.com/` and reported that its URL was too long again. Its complete URL measures **43,663 characters**, with a `#b=c.` payload of 43,626 characters. Decoding locally found four objects, two embedded photos totaling 34,990 data-URL characters, and arrangement settings. No names, message bodies, photos or complete URL are reproduced in this plan.

The desired result is a working gift link such as `https://bouquetforyou.lar-ykt.com/#s=<16-character-code>`. At this exact origin the complete URL is **53 characters**, independent of the number of supported photos or notes. The angle-bracket notation here describes a contract, not a deployable value.

When a creator opens Share bouquet, the latest complete gift must be saved durably before Copy link or Share via becomes usable. If saving fails, show a useful failure and Retry; never silently generate a portable URL. Recipients on another browser/device must retrieve the same immutable gift, with photos, crops, frame orientation, notes and arrangements intact.

Fixing only the fallback UI does not complete the live issue: Cloudflare needs a durable `/api/bouquets` implementation and correct routing. Conversely, adding a backend without changing the catch-all fallback leaves the recurrence mechanism in place.

## Requirements and boundaries

### Must have

1. All newly generated share links use `#s=` and a cryptographically random, 16-character base64url code. At the current public root origin, assert an exact length of 53; at other origins assert the hash contract without imposing a hostname-independent total length.
2. A Cloudflare Worker serves the existing same-origin API paths, backed by D1 persistence, without depending on Node filesystem storage.
3. Write succeeds before ready state; immediate retrieval from a fresh client succeeds; restarting local emulation retains saved links.
4. Preserve immutable snapshots and concurrent identical-save deduplication. No expiry or background deletion of saved gifts is introduced.
5. Pending, error, retry and cancellation work; old or outdated link values cannot be copied or shared after an edit.
6. Missing API, HTML fallback, bad JSON/code, timeout, network failure, 429, 413 and storage failures are explicit errors. No failure produces `#b=`.
7. Preserve existing validation limits, bounded JSON input (190,000 bytes), and an application snapshot capacity of 100 MiB. The Worker uses a persisted 120-creation-attempts-per-rolling-hour limit per client identifier.

### Must preserve

- Existing `#b=` compact and legacy links remain readable; retain `encode`, `decode` and `shareUrl` for compatibility/testing. Keep the compressed wire format and `BouquetConfigV1` unchanged.
- Existing Node/Vite API and `.data/shares` remain operational. They are useful for local editing and existing Node deployments.
- Account-free recipient flow, gift reveal, title/body synchronization, clipboard fallback, native sharing, draft protection until Remix, undo/redo, PNG output and all bouquet content.
- Existing site design and mobile layouts. Only sharing status, an error message and a Retry button change in the dialog.
- Existing stored links: never delete or recreate storage as a deployment shortcut. If production discovery finds an existing share backend, inspect its records/contracts before switching traffic.

### Must not have

- Automatic portable fallback, URL truncation, dropped photos, extra photo compression, new accounts, public photo buckets, third-party shorteners or a separate paid-service signup.
- Frontend credentials or client direct database access; no gift contents or full share URLs in logs.
- A hosting migration, replacement frontend Worker, DNS changes or ownership assumptions just to implement this API.
- Remote resource creation, migrations, deployment, pushes or production test writes during the local implementation phase.

### Don'ts

- Do not assume Vite's `configureServer`/`configurePreviewServer` middleware is bundled into `dist/`.
- Do not import `server/shareStore.ts`, `server/shareApi.ts`, `node:fs` or `node:http` into the Worker. `nodejs_compat` does not make `.data/shares` durable on Cloudflare.
- Do not use KV for this chosen implementation or an in-memory Map for cross-request quota/deduplication. D1 is the selected persistence layer.
- Do not keep the present `.catch(() => {})` for creation errors, enable Copy during errors, or reuse a previously ready link while a new config is pending.
- Do not remove portable decode coverage just because portable link creation disappears from the UI.
- The owner's no-environment-variable rule is explicitly for n8n. This is a web application; the D1 binding is a server-side Cloudflare resource binding, with no new frontend secret.

## Context and evidence

### Instructions and stack

No repository or ancestor `AGENTS.md` was found in the inspected project, `PROGRAMMING` or Desktop locations. Follow the owner's supplied AGENTS instructions and recheck applicable ancestor instructions at execution time. `Vault/AGENTS.md` was read and ATLAS project setup completed for this canonical directory. ATLAS context supplied no project-specific sharing decision. No knowledge note is needed for this routine diagnostic handoff.

Skill sources read: `C:\Users\user\.agents\skills\implementation-plan\SKILL.md`, its `references/plan-format.md`, and the `cloudflare`, `workers-best-practices` and `wrangler` skills in the same skills root. The planning skill explicitly limits this invocation to the Markdown plan and necessary evidence.

Installed stack: Node 24.18.0, npm 11.16.0, React/React DOM 19.3.0, Vite 7.3.6, TypeScript 5.9.3, Vitest 5.0.3, Playwright 1.63.0 and lz-string 1.5.0. Existing scripts use npm and PowerShell, with native Node TypeScript config loading. A global Wrangler 4.147.0 exists; the project has no Wrangler dependency/configuration. Its installed schema confirms a D1 binding can omit `database_id` for local use. Pin project tooling rather than depending on that global installation.

### Current flow and source map

| Verified path | Anchor | Established responsibility | Planned action |
| --- | --- | --- | --- |
| `src/App.tsx` | `showShare`, sharing `useEffect`, `copyLink`, `nativeShare`, `modal === 'share'` | Debounce 350ms; stores `{config,url,short}`; ignores rejected promises; enables portable URLs | Explicit ready/error state and retry, latest-config guards |
| `src/sharing.ts` | `createShareLink`, `endpoint`, `openSharedBouquet` | POST `{config}`; accepts code; every non-user-abort failure returns `shareUrl`; receiver GETs `{payload}` | Short-only creator; preserve reader |
| `src/config.ts` | `validate`, `encode`, `decode`, `shareUrl`, `DRAFT_KEY` | Includes full photo strings in compressed payload; compatibility and validation | Preserve unchanged |
| `src/giftCatalog.ts` | `PHOTO_LIMIT`, `PHOTO_TOTAL_LIMIT`, `GiftObject` | 24,000 characters/photo, 48,000 total; object note/crop/orientation | Preserve unchanged |
| `src/objectPhotos.ts` | `prepareObjectPhoto` | Already prepares compact embedded JPEG sources | Preserve unchanged |
| `server/shareStore.ts` | `ShareStore.save/get` | Immutable disk snapshots, SHA-256 deduplication, random 12-byte code, 100 MiB capacity | Preserve; independent D1 equivalent |
| `server/shareApi.ts` | `shareApi` | Node API, JSON/origin checks, size/rate limits, response shapes | Preserve; Worker matches public contracts |
| `server/sharingPlugin.ts`, `vite.config.ts` | Vite hooks | Dev/preview service only | Preserve |
| `server/index.ts` | production server | Node static server plus disk API | Preserve |
| `tests/sharing.test.ts` | saved sharing suite | Storage restart/dedup, real Node HTTP API, currently expects fallback | Update fallback assertion; extend frontend failure tests |
| `tests/browser/shareHelpers.ts` | `readyLink`, `sharedDesign` | Reads saved or portable gifts | Tighten ready state helper; retain portable reader helper |
| `tests/browser/app.spec.ts` | fresh-context and native-sharing tests | Draft isolation, latest title/body, clipboard denial | Preserve and extend |
| `tests/browser/studio.spec.ts`, `flower-arrangement.spec.ts`, `filler-arrangement.spec.ts`, `live-flower-editor.spec.ts`, `surprise-studio.spec.ts` | mocked `**/api/bouquets` 503 blocks | Explicitly expect portable fallback today | Update to failure/retry; test old portable links directly |
| `package.json`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts` | scripts/compiler/config | Existing Node/browser test infrastructure | Add isolated Worker commands/types/testing only |
| `README.md` | Bouquet sharing | Describes fallback and says no deployment exists | Update local behavior; distinguish owner-reported host from verified activation |

The repository contains no discovered Wrangler, Pages, Docker, Netlify, Vercel or CI deployment configuration. The owner identified the live hosting family as Cloudflare Pages/Workers. The pasted dialog proves the fallback branch was reached; it does **not** prove which HTTP error or Cloudflare setting caused it.

### Baseline observations

Commands below ran in the project root unless indicated otherwise:

- `git status --short`, `git branch --show-current`, `git log -1`: clean, main, revision above.
- Local, read-only decoding with lz-string measured the supplied URL and counted objects/photos; personal contents were not printed.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed** with exit 0.
- `npm.cmd test -- tests/sharing.test.ts tests/core.test.ts tests/objects.test.ts tests/notes.test.ts`: two suites passed (nine tests), two suites failed to load with temporary SSR-file `ENOENT` under the Windows sandbox; no failed test assertions were reported.
- Retry `npm.cmd test -- tests/sharing.test.ts tests/core.test.ts --no-file-parallelism`: core passed (26 tests), sharing still failed to load with temporary SSR-file `ENOENT`. Do not count sharing as passed or diagnose this as an application assertion failure.
- `npm.cmd run lint` produced no completed result before cancellation; a chained typecheck did not run. The standalone typecheck above is the observed result. Lint is unverified.
- Browser checks, a build, Worker emulation, deployment and live API writes were not run during planning.
- Both web retrieval and PowerShell GETs for the public root/API failed. PowerShell reported DNS `No such host is known`; this is a limitation of this environment, not proof the domain is down for the owner.
- npm registry access from the shell also failed DNS. The npm publisher page exposed Wrangler 4.152.0; installability and its local schema still require executor preflight.

### Primary guidance consulted

- [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) — bindings, local storage configuration.
- [Cloudflare routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) — a path route can sit ahead of an existing proxied site; exact route/proxy ownership must be checked.
- [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) — bound database, prepared statements and transactional batches. Direct database queries without sessions target the primary; this plan does not enable replica sessions.
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) — `.bind`, `.first`, `.all` and `.run`.
- [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/) — local migrations and explicit remote operations.
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) — bounded input, generated binding types, awaited writes and structured errors.
- [Wrangler publisher versions](https://www.npmjs.com/package/wrangler?activeTab=versions) — proposed exact dev-tool pin 4.152.0.

## Chosen design and contracts

Keep the current frontend and same-origin API contract. Add an **API-only Worker** with D1 storage. Deploy it later on the narrow route `bouquetforyou.lar-ykt.com/api/bouquets*`, leaving the current Pages/application origin responsible for HTML/assets. This works without first choosing whether that origin is Pages or a static-assets Worker; S9 must confirm route compatibility and conflicts before activation. Out-of-contract paths captured by the wildcard return JSON 404, never forward recursively to the same URL.

D1 stores the existing compressed payload including photos. Do not split photos into another storage product. D1 provides atomic SQL writes, deduplication and immediate primary reads without KV propagation behavior. Cost/quotas and the actual account are to be reviewed before provisioning, not assumed approved by this plan.

### Public API (preserve existing successful shapes)

| Request | Success | Other outcomes |
| --- | --- | --- |
| `GET /api/bouquets` | 200 `{shortLinks:true}` after a small D1 readiness query | 503 if binding/schema/storage unavailable |
| `POST /api/bouquets` JSON `{config: BouquetConfigV1}` | 201 `{code:string}` only after durable write/dedup read | 400 validation/JSON; 403 foreign origin; 413 body limit; 415 non-JSON; 429 rate; 507 capacity; 503 database/internal |
| `GET /api/bouquets/<code>` | 200 `{payload:string}` | 400 malformed code; 404 absent; 503 storage failure |
| Other API methods | — | 405, `Allow: GET, POST` on collection and `GET` on item |

All responses: JSON UTF-8, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. No CORS allow-origin. If Origin exists, compare its full origin with `new URL(request.url).origin`, rejecting malformed/foreign values. No credentials needed. Client creator validates content type, JSON structure, runtime `typeof code === 'string'`, regex and exact hash shape before reporting ready.

### Frontend creation and UI state

- Keep `createShareLink(config, signal, address?)` arguments. Return type becomes `Promise<{url:string; short:true}>`, preserving the success field for existing tests/callers. Remove `shareUrl` import and all fallback calls from this module.
- Add exported `ShareLinkError` with `reason: 'unavailable' | 'timeout' | 'rate-limited' | 'invalid-gift'`, controlled user-facing `message`, and optional HTTP `status`. HTTP 400/413 map to invalid-gift, 429 to rate-limited, remaining failures to unavailable. Caller abort must reject as cancellation and never update error UI. Keep the existing 6-second creation deadline; distinguish deadline from caller abort.
- Generic message: `We couldn't create a short link. Your bouquet is still here. Try again.` Timeout: `Creating your short link took too long. Try again.` Rate limit: `Too many link requests. Please try again later.` Invalid-gift: `This bouquet couldn't be saved. Check your gift and try again.` Never display raw server exceptions/HTML.
- In App, replace link state with the exact union below. Add `shareAttempt` numeric state initialized to 0. No other component owns these states.

```typescript
// Proposed type, untested; place near other App-local types.
type ShareLinkState =
  | { status: 'ready'; config: BouquetConfigV1; url: string }
  | { status: 'error'; config: BouquetConfigV1; message: string }
  | null;
```

- Derive `currentLink = link?.config === config ? link : null`, `canShare = currentLink?.status === 'ready'`, pending when modal is open and currentLink is null. Ready URL is empty unless canShare; both button attributes **and handlers** check canShare and status narrowing.
- `showShare` clears link and copied state before opening. Retry clears link/copied state and increments shareAttempt. The existing effect depends on `[modal, config, shareAttempt]`; keep debounce 350ms and abort cleanup. Resolve to ready, reject non-cancellation to error, and check the effect's request signal before either write. An edit invalidates the old state immediately by config identity, even before debounce.
- Pending copy: existing `Saving your gift and preparing a short link…`; ready: `Short link ready · N characters, pictures included`; error uses the controlled message with `role="alert"`, and an enabled `Retry` secondary button. Pending/ready status remains `role="status"`. Keep Title/Body editable in every state. Input stays empty on pending/error; use `Short link unavailable` as error placeholder. Clipboard selection fallback remains unchanged for ready links.
- Use existing `secondary-button`, `link-status` and dialog layout; no theme/layout overhaul or new CSS is required. Remove portable-specific dialog copy and class usage. Privacy disclosure still names notes/photos when present, and immutable-snapshot copy appears only in ready state.

### Cloudflare configuration and storage

Proposed new identities, not discovered existing resources: Worker `bouquetforyou-share-api`, D1 database `bouquetforyou-shares`, binding `BOUQUET_SHARES`. These may be created only in S9 after discovery and authorization. If a resource with either name already exists, stop before attaching/replacing it until ownership is established.

Create `cloudflare/wrangler.jsonc` for **local-only** development. Do not put production routes/account IDs or fake database UUIDs in it:

```jsonc
{
  "$schema": "../node_modules/wrangler/config-schema.json",
  "name": "bouquetforyou-share-api",
  "main": "./worker.ts",
  "compatibility_date": "2026-10-26",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
  "observability": { "enabled": true },
  "d1_databases": [
    {
      "binding": "BOUQUET_SHARES",
      "database_name": "bouquetforyou-shares",
      "migrations_dir": "./migrations",
      "remote": false
    }
  ]
}
```

This proposed configuration is untested. Validate with pinned Wrangler's own schema/dry run. No `database_id` is needed for local emulation; a separate production configuration must use the real ID once known.

Create `cloudflare/migrations/0001_bouquet_shares.sql` with the following proposed complete schema:

```sql
CREATE TABLE bouquets (
  code TEXT PRIMARY KEY NOT NULL CHECK(length(code) = 16),
  digest TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length > 0),
  created_at INTEGER NOT NULL
);
CREATE TABLE share_rate_limits (
  ip_hash TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count > 0)
);
CREATE INDEX share_rate_window ON share_rate_limits(window_start);
```

No gift update/delete endpoint. Do not expire bouquets. `byte_length` is `new TextEncoder().encode(payload).byteLength`. This is the app's payload capacity accounting, not a claim about D1 physical/database billing size.

`cloudflare/shareStore.ts` exports `D1ShareStore`, constructed with generated `Env['BOUQUET_SHARES']`. Methods: `save(input: unknown): Promise<string>`, `get(code:string): Promise<string|null>`, `consumeRateLimit(client:string, now:number): Promise<boolean>`, `ready(): Promise<void>`. Validate and encode with the existing config functions. `get` checks the same regex and decodes the returned payload before returning it; absent rows return null and corrupt/database data throws to API 503.

Use direct binding `.prepare` calls, without Sessions API/read replicas. D1 reads therefore use primary consistency per the consulted docs. SHA-256 digest uses Web Crypto; ID generation uses 12 random bytes and base64url conversion, exactly 16 characters. Hash the client address for the rate table; do not retain/log raw IPs or gift data. Worker trusts `CF-Connecting-IP`, falling back to `unknown` in local tests; never trust arbitrary X-Forwarded-For.

For rate limiting, hash the supplied client string, prune entries older than one hour, and execute this single atomic UPSERT, binding the same `now` value each place. Return true for request_count <=120. Preserve rolling-hour semantics from first attempt, rather than allowing a reset at every clock-hour boundary:

```sql
INSERT INTO share_rate_limits(ip_hash, window_start, request_count)
VALUES (?, ?, 1)
ON CONFLICT(ip_hash) DO UPDATE SET
  request_count = CASE WHEN share_rate_limits.window_start <= ? - 3600000
    THEN 1 ELSE share_rate_limits.request_count + 1 END,
  window_start = CASE WHEN share_rate_limits.window_start <= ? - 3600000
    THEN excluded.window_start ELSE share_rate_limits.window_start END
RETURNING request_count;
```

Perform cleanup + UPSERT in an awaited D1 `batch`; use a separate bounded cleanup of obsolete rows only, never remove bouquet records. Count valid JSON creation attempts before saving, including dedup retries. Validate basic request method/origin/body/config before consuming a limit. Database failure must fail closed with 503.

For save: normalize with validate, encode, digest; first read an existing digest. Otherwise use this atomic capacity-checked insertion, with fresh random code and current timestamp. All user values use prepared bindings:

```sql
INSERT INTO bouquets(code, digest, payload, byte_length, created_at)
SELECT ?, ?, ?, ?, ?
WHERE COALESCE((SELECT SUM(byte_length) FROM bouquets), 0) + ? <= 104857600
ON CONFLICT DO NOTHING
RETURNING code;
```

Use `.all<{code:string}>()` and inspect `results[0]`. If no row: query the digest again (a concurrent identical save may have won); then query total capacity. If full, throw a dedicated capacity error mapped to 507. Otherwise treat it as a code collision and retry with a new code, at most three attempts; exhaustion is 503. No replacing/updating saved payloads. Concurrent SQL statements must not reserve capacity with an unguarded application read-then-write. Test exactly-at-limit, over-limit and simultaneous identical/different inserts against real local D1.

## File and resource change map

| Step | File/resource | Action | Anchor / required change |
| --- | --- | --- | --- |
| S2 | `src/sharing.ts` | Modify | Short-only creator and typed errors; reader compatibility |
| S3 | `src/App.tsx` | Modify | Link state/effect/actions/dialog failure and Retry |
| S4 | `package.json`, `package-lock.json` | Modify | Pin Wrangler dev tool; local Worker scripts |
| S4 | `cloudflare/wrangler.jsonc`, `cloudflare/tsconfig.json`, `cloudflare/worker-configuration.d.ts` | Create | Local binding, isolated compiler and generated types |
| S4 | `cloudflare/migrations/0001_bouquet_shares.sql` | Create | Tables above |
| S4 | `.gitignore`, `eslint.config.js` | Modify | Ignore local Wrangler state/build output and generated runtime declarations |
| S5 | `cloudflare/shareStore.ts` | Create | D1 implementation above |
| S6 | `cloudflare/worker.ts` | Create | Web Request/Response API adapter |
| S6 | `scripts/verify-cloudflare-sharing.mjs` | Create | Local-only HTTP/D1/restart acceptance harness |
| S7 | `tests/sharing.test.ts`, `tests/browser/shareHelpers.ts` | Modify | Reject fallback, mock failures; ready helper requires short ready state |
| S7 | `tests/browser/sharing-errors.spec.ts`, `playwright.sharing.config.ts` | Create | Focused failure/retry tests; optional local Worker API routing fixture |
| S7 | Five browser specs listed in source map | Modify | Replace fallback assertions; preserve explicit old-link round trips |
| S8 | `README.md`, `docs/cloudflare-sharing-deployment.md`, `docs/verification/2026-10-26-short-links.md` | Modify/create | Accurate behavior, gated activation and observed QA |
| S9 | Cloudflare Worker/D1/route and existing frontend deployment | External, pending | Exact account, IDs and existing project resolved before any write |

## Ordered implementation steps

### S1 — Recheck and record execution baseline

- **Depends on:** new user request to execute this plan.
- **Target:** project state and source anchors above.
- **Preflight:** read full plan, applicable AGENTS instructions and named skills. Inspect git status/HEAD, `src/sharing.ts`, share state/effect/dialog in App, existing tests and deployment files. Save current user edits in the verification report by path, without copying private contents.
- **Action:** rerun standalone typecheck and focused tests. Use separate commands so lint cannot hide typecheck results. Do not install or upgrade application libraries to address sandbox SSR ENOENT.
- **Verify:** commands from the project root:

```powershell
git status --short
git rev-parse HEAD
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd test -- tests/sharing.test.ts tests/core.test.ts tests/objects.test.ts tests/notes.test.ts --no-file-parallelism
```

- **Expected:** contracts still match; current baseline is recorded honestly.
- **If it fails:** temporary-file ENOENT may be rerun once through an available approved execution context. A real assertion failure needs diagnosis before dependent changes. Materially different share/deploy contracts require revising this plan. Preserve all user changes.

### S2 — Remove automatic portable creation

- **Depends on:** S1.
- **Target:** `src/sharing.ts:createShareLink` and related imports/errors.
- **Preflight:** callers remain App plus sharing tests; search again before editing.
- **Action:** implement the frontend creation contract above. Validate config before POST. Keep abort listener/timer cleanup and abort propagation. Check response media type and code at runtime; handle parse errors as unavailable. Remove automatic `shareUrl` return path. Leave `openSharedBouquet` behavior and `src/config.ts` serialization intact.
- **Expected:** each call either returns a valid short link or rejects; no successful portable result exists.
- **Verify:** new unit tests mock success, foreign HTML 200, invalid JSON, absent/non-string/bad code, 404/405/413/429/503, network rejection, timeout and caller abort. Successful exact-origin example is 53 characters even with two photos. Use fake timers for timeout tests and restore fetch/timers per test. Do not make real public POSTs.
- **If it fails:** fix only this module/test contract. A missing API is an expected failure case, not grounds to restore fallback.

### S3 — Make save failure visible and retryable

- **Depends on:** S2.
- **Target:** App link state, `showShare`, creation effect, `copyLink`, `nativeShare`, share dialog.
- **Action:** implement union/derived state/retry contract above. Keep 350ms debounce, title/body inputs and privacy disclosure. Do not store copied state independently of an invalidated config. Render status/error exclusively so failure never appears as endless loading. Avoid adding setState in the effect body: showShare/Retry invalidate state, config identity derives pending; effect resolves/rejects asynchronously.
- **Expected:** current saved gift is the only copyable/shareable result; failure is actionable and edits/drafts survive.
- **Verify:** typecheck; focused browser tests cover failure, Retry success, editing during request, closing/reopening and stale resolution. At 320×844, 390×844 and 1280×960, error/Retry are readable, keyboard reachable and within the existing scrolling dialog; no horizontal overflow. Clipboard denial still selects the ready link.
- **If it fails:** inspect state ownership/abort cleanup; do not weaken guards or add a timeout that enables an unsaved link.

**Checkpoint A:** S2–S3 frontend tests/typecheck pass (or explicitly recorded environment blocker); no App/creator branch generates `#b=`. Old decoder remains intact.

### S4 — Add local Cloudflare tooling and schema

- **Depends on:** S1; independent of S2–S3.
- **Target:** new cloudflare files and tooling files in map.
- **Action:** install `npm.cmd install --save-dev --save-exact wrangler@4.152.0` only during authorized implementation. Validate installed `engines` against Node 24 and its schema before using the config. If package access is unavailable, stop this dependent phase with the local network error; do not quietly choose an unverified version or use latest.
- Create proposed config/migration. Add `.wrangler/` and `.checks/cloudflare/` ignore entries (the latter is already covered by `.checks/`, so avoid duplicates). Exclude only `cloudflare/worker-configuration.d.ts` from ESLint, not handwritten Worker files.
- Generate complete runtime/binding types with `npm.cmd exec wrangler -- types cloudflare/worker-configuration.d.ts --config cloudflare/wrangler.jsonc`. Confirm generated `Env` contains `BOUQUET_SHARES`; do not hand-author binding types.
- Create isolated `cloudflare/tsconfig.json`: extend root compiler options, set `types: []`, include `./**/*.ts` and generated declarations. Root App compiler must not gain global Worker runtime declarations. Its transitive shared imports are checked through the Worker project.
- Add scripts with these exact names/actions: `cf:types` (generation above), `cf:typecheck` (`tsc --project cloudflare/tsconfig.json --noEmit --incremental false`), `cf:migrate:local` (`wrangler d1 migrations apply BOUQUET_SHARES --local --config cloudflare/wrangler.jsonc --persist-to .checks/cloudflare/state`), `cf:dev` (`wrangler dev --local --config cloudflare/wrangler.jsonc --port 8787 --persist-to .checks/cloudflare/state`), `cf:check` (`wrangler deploy --dry-run --config cloudflare/wrangler.jsonc --outdir .checks/cloudflare/build`), and `test:cf-sharing` (`node scripts/verify-cloudflare-sharing.mjs`). Validate CLI flags with installed `--help`; record harmless syntax adjustments, never substitute `--remote`.
- **Verify:** schema parse/type generation; local migration after Worker entry file exists in S6. No production IDs or routes in local config and no external resources created.
- **If it fails:** isolate generated runtime types from App compilation; do not edit generated declarations by hand. Material API/version mismatch requires updating the affected plan contract first.

### S5 — Implement durable snapshots and atomic limits

- **Depends on:** S4.
- **Target:** `cloudflare/shareStore.ts:D1ShareStore`.
- **Action:** implement exact methods/algorithms/SQL above. Use `Env['BOUQUET_SHARES']`, imports from existing config, Web Crypto and TextEncoder. Define a dedicated capacity exception in this module and map it in S6. Await writes before returning a code. Rate client hash is SHA-256 UTF-8 lowercase hex; hash is an operational key, not a promise of anonymization.
- **Expected:** code and payload survive process restart; repeated or simultaneous identical inputs return one code; later edits produce another immutable row.
- **Verify:** S6 local D1 harness exercises schema with actual binding, concurrent saves, invalid input, quota, code regex and restart. Do not substitute only a mocked Map test. Test aggregate capacity SQL at boundary using test-local rows/byte accounting inside the isolated test database, then restore only those test rows.
- **If it fails:** check prepared binding order and RETURNING semantics against installed runtime. Keep transaction/atomic constraints; do not make dedup or quota a race-prone read/write pair.

### S6 — Implement API and real local persistence verification

- **Depends on:** S4–S5.
- **Target:** `cloudflare/worker.ts`, verification harness.
- **Action:** export a module Worker fetch handler using generated `Env` and `satisfies ExportedHandler<Env>`. Match API table exactly. For JSON body, enforce Content-Length early if present and also stream/count `Uint8Array` chunks before accumulating up to 190,000 bytes; reject/cancel over limit, including chunked requests. Decode UTF-8 after bounded collection, parse/validate, enforce origin, then rate and save. A missing D1 binding/failed readiness query is 503. Do not return shortLinks:true without testing DB schema availability.
- All logs must contain only operation/error category, status and a random request ID; omit payloads, code, messages, IPs and photos. Catch database failures explicitly and return controlled JSON. Do not enable passThroughOnException or fetch the same request as fallback.
- Create local-only `scripts/verify-cloudflare-sharing.mjs`. It spawns repository-pinned Wrangler on an isolated port 8788, with persistence `.checks/cloudflare/test-state`, migrates that local state, waits for readiness with a bounded deadline, uses Node fetch/assert to test the API, terminates only its own child, restarts with the same state and retests saved code. Use `process.execPath` and Wrangler's installed JS entry via package resolution to avoid Windows `.cmd` spawn ambiguity. Never terminate other Node/Wrangler processes or delete a computed directory recursively. Repeated runs use distinct synthetic client IDs and test payload markers; no production target argument is allowed.
- Use synthetic complete configs with two compact photo strings, one rich envelope note, frame orientation/crop, flower/filler edits and Unicode title/body. The Node 24 `.mjs` harness imports `clone`, `starter`, `validate`, `encode` and `decode` directly from `../src/config.ts`, and `createGiftObject` from `../src/giftCatalog.ts`, using native TypeScript stripping already required by `npm start`. Construct the payload with the proposed excerpt below. It must not read the owner's pasted personal payload. For SQL boundary setup, invoke local D1 CLI with explicit test-state and temporary SQL files under `.checks/cloudflare`; no `--remote`.

```javascript
// Proposed harness fixture excerpt, untested. Imports named above precede it.
const config = clone(starter);
config.gift = { to: 'Test recipient', from: 'Test sender', title: 'Test bouquet 花', message: 'Synthetic round-trip fixture.' };
for (const id of ['standing-frame', 'landscape-frame', 'sealed-envelope']) {
  config.objects.push(createGiftObject(id, config.objects));
}
for (const frame of config.objects.slice(0, 2)) {
  frame.photo = 'data:image/jpeg;base64,/9j/AAAA';
  frame.crop = { mode: 'fill', zoom: 1.5, x: 0.25, y: -0.25 };
  frame.frameOrientation = 'landscape';
}
config.objects[2].note = { align: 'center', runs: [{ text: 'Synthetic note 花', font: 'serif', size: 20, bold: true, color: '#123456' }] };
config.arrangement = {
  profile: 'stepped', showStems: true, height: 0.2,
  edits: [{ key: 'rose:0', height: 0.1, size: 1.1, x: 0.1, z: 0 }],
  fillerProfile: 'natural', fillerHeight: 0.1, fillerSize: 1.1, fillerSpread: 1.1,
  fillerEdits: [{ key: 'eucalyptus:0', height: 0.1, size: 1.1, x: 0, z: 0.1 }]
};
const expected = validate(config);
```

The photo string above is the existing unit-test sentinel: use it only for storage round-trip tests; it does not establish visual image decoding. Browser rendering tests must create real JPEG data with the page's canvas `toDataURL('image/jpeg')`, seed a synthetic draft, and compare photos/crop/orientation in the opened gift as well as checking the visible frame image.
- **Verify:** `npm.cmd run cf:migrate:local`, `npm.cmd run cf:typecheck`, `npm.cmd run cf:check`, `npm.cmd run test:cf-sharing`. Inspect emitted bundle/imports for no filesystem/server/browser-only dependencies. Existing config imports surprise/layout/three; tree shaking should remove unused exports. If bundle loads DOM/WebGL side effects or exceeds current Cloudflare limits, stop for a narrow pure-codec extraction plan; do not rewrite the 3D app.
- **Expected:** actual Workers runtime and D1 pass round trip/restart/concurrency/error checks with no remote calls.
- **If it fails:** distinguish emulator startup/permissions from Worker errors; preserve stderr without private contents. A mock-only result is insufficient for this checkpoint.

**Checkpoint B:** schema, Worker types/dry-run, real D1 API persistence and existing Node service tests are green or specifically blocked with evidence. Local resource state remains separate from production.

### S7 — Update callers and meaningful regression tests

- **Depends on:** S2–S3 and S6 for Worker browser integration.
- **Target:** unit/browser files in map.
- **Action:** update the static-host assertion in `tests/sharing.test.ts` to rejection; keep Node real-server storage tests. Add mocked frontend tests for all creation failures/cancellation. Keep API origin/content type/size and corrupt/missing payload tests.
- `readyLink` must wait for `.link-status` to contain `Short link ready`, require Copy enabled and assert `#s=`; keep `sharedDesign` able to decode old `#b=` fixtures.
- In all five specs with mocked 503 fallback, require error and disabled Copy, then create a **legacy fixture directly with `shareUrl(saved, page.url())`** and open it in a recipient context to preserve existing portable arrangement/object fidelity checks. Preserve variables used by subsequent short-link recipient/remix/PNG steps. Never call `readyLink` while API is mocked 503. Titles changed inside the failure block should be copied into the explicit legacy fixture where that assertion needs them.
- Add `sharing-errors.spec.ts`: mock 503 then restore API and Retry; 429/413; HTML 200; deadline; denied clipboard; edit while first request is delayed and resolve stale response; close dialog while pending; reopen after failure. Native share mock records payload and cannot be called until current config is ready. Verify the new title/body and full snapshot after rapid edits.
- Add `playwright.sharing.config.ts` extending existing config with a focused testMatch. To test actual Worker without modifying normal Vite middleware, use a dedicated browser test fixture that forwards only `/api/bouquets` requests via Playwright route to local Worker 8787; normalize Origin to the local target origin for this fixture only and preserve HTTP method/body/response status. Add an explicit original cross-origin rejection test directly against the Worker. Start/stop the local Worker through Playwright webServer entries, with local migration first; Vite still serves frontend. This forwarding is test-only, not production CORS behavior.
- **Verify:** unit tests plus focused browser command `npm.cmd exec playwright -- test --config playwright.sharing.config.ts`; existing changed specs with `npm.cmd exec playwright -- test tests/browser/studio.spec.ts tests/browser/flower-arrangement.spec.ts tests/browser/filler-arrangement.spec.ts tests/browser/live-flower-editor.spec.ts tests/browser/surprise-studio.spec.ts tests/browser/app.spec.ts`.
- **Expected:** both runtimes produce short links; old portable readers still preserve complete designs; errors never copy giant/stale links.
- **If it fails:** update the relevant fixture/call site, not production validation or unrelated rendering. For runtime/test-environment blockers, state exact blocked scenarios and do not mark them passed.

### S8 — Complete local validation and prepare activation documentation

- **Depends on:** S2–S7.
- **Target:** README, deployment and verification docs.
- **Action:** update sharing documentation to short-only creation with explicit save failure; keep legacy-portable reader and standalone Node instructions. Explain that static-only `dist/` cannot create new links. Document Worker/D1 setup, narrow path route, persistence/backup ownership and the exact deployment gate. Correct old “no public URL exists” text to owner-reported domain with activation status, without inventing deployment history.
- Run all local gates once after focused tests pass: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test -- --no-file-parallelism`, `npm.cmd run build`, `npm.cmd run cf:typecheck`, `npm.cmd run cf:check`, `npm.cmd run test:cf-sharing`, followed by prescribed browser checks. Avoid unrelated broad lint fixes (including `project-demo`). Distinguish pre-existing failures and runtime blockers with exact evidence.
- Save report with changed files, real outcomes, screenshots at required viewports, exact short-link length, concurrency/restart evidence and any unavailable live checks. Inspect `git diff --check` and status; ensure private payload and local database contents are untracked/ignored.
- **Expected:** local source and reviewable activation instructions complete. Explicitly report that the public site remains unmodified until S9.
- **If it fails:** diagnose only changed behavior or record a bounded environment blocker. Do not call local success a deployed fix.

### S9 — Production activation, separately gated

- **Depends on:** S8, exact account/project/resource discovery, required access and a current explicit request authorizing the listed external writes.
- **Target:** public origin `https://bouquetforyou.lar-ykt.com`, narrow API route, proposed Worker and D1 identities above; **actual account ID, frontend project identity, existing route ownership, database ID and build pipeline are unresolved**.
- **Read-only preflight:** with an authenticated Cloudflare connection or pinned Wrangler, identify account(s), inspect the actual Pages project/Worker serving this domain, DNS proxy status and overlapping routes. Inspect existing bindings/storage and rollout procedure. Record exact IDs in `docs/cloudflare-sharing-deployment.md` before requesting activation approval. Do not infer a Pages project name from the hostname/repository. Do not expose credentials.
- **Pending external actions:** create a dedicated `bouquetforyou-shares` D1 only after confirming no intended existing store; apply `0001_bouquet_shares.sql` there; bind `BOUQUET_SHARES`; deploy `bouquetforyou-share-api`; add `bouquetforyou.lar-ykt.com/api/bouquets*` route in the verified `lar-ykt.com` zone; publish frontend build through the discovered existing pipeline. Use a separate production config populated with the actual account/database IDs. Do not deploy the local-only config, allow implicit resource auto-provisioning or invent IDs. Commands dependent on those IDs are deliberately not labeled copy-ready here.
- Keep existing frontend and route configuration as a rollback record. If an earlier saved backend is found, stop switching until preservation/import of its existing codes is specified; no existing record deletions are authorized.
- **Verification after authorization:** GET readiness must be JSON 200; create one synthetic gift containing test photos/notes; open its 53-character root-domain link in a fresh browser context and another device/network if available; verify complete contents and draft isolation, then deploy/restart Worker without losing link access. Test a controlled failure in preview/local environments, not a production outage. Verify HTML/catalog/assets still served by original application. Record DNS/network limitations honestly.
- **Expected:** public short creation and cross-device retrieval confirmed; no production test gift contains personal data.
- **If it fails:** roll back only task-owned routing/code changes to recorded prior versions, retaining D1 and all saved records. Never delete D1 as rollback. If a frontend rollback would restore automatic fallback, prefer holding short-only frontend with visible retry error while repairing API. Stop on ambiguous ownership, incompatible routing, missing authorization or a requirement to change DNS/site architecture.

## Acceptance and verification matrix

| Scenario | Input/setup | Expected result / evidence |
| --- | --- | --- |
| Original failure trigger | Synthetic two-photo gift + unavailable API | Error/Retry; no URL; Copy/native share disabled; draft unchanged |
| Public-origin length | Successful save with `address='https://bouquetforyou.lar-ykt.com/'` | Exact 53 chars; `#s=` plus 16-char code; no gift data in URL |
| All content | Photos, crops, orientations, note formatting, Unicode, flower/filler arrangement | Saved payload decodes to normalized complete input |
| Storage durability | Save, stop local Worker, restart same D1 state | Same code retrieves same gift from new client |
| Immutability/dedup | Concurrent identical requests; later title/photo edit | Identical requests share code; edited gift uses new code; old payload unchanged |
| Capacity | Exactly 100 MiB payload accounting, one byte over, concurrent inserts | Atomic cap; dedup still works at capacity; 507 produces visible retryable failure |
| Rate | 120 attempts, 121st, then one hour later; two clients | 120 allowed; 121st 429; reset after window; clients isolated |
| Request boundaries | Foreign/malformed Origin, wrong type, malformed config, chunked oversize, unsupported method | Correct controlled 4xx JSON; no persistence |
| Broken response | HTML 200, malformed JSON/code, network rejection/deadline | No portable fallback; correct error; aborted caller does not set error |
| Retry/stale results | Fail then Retry; edit title/body mid-flight; close/reopen | Latest config only; stale code never copyable/shareable; UI settles |
| Legacy links | Old compact and pre-compact `#b=` fixtures | Same gift opens; no schema/version migration or missing content |
| Existing Node | Current ShareStore/service tests | Local dev/preview/Node saved sharing retained |
| Recipient behavior | Fresh context with own draft; open then Remix | Draft unaffected while viewing; Remix explicitly adopts gift |
| Dialog usability | 320×844, 390×844, 1280×960, keyboard | Status/Retry readable, focusable, no overflow, inputs usable |
| Production | Authorized actual Cloudflare deployment | Live GET/POST/GET and recipient round trip; separate from all local evidence |

## Recovery and stop conditions

Task-owned changes are only files/resources listed in the map. Preserve any newer user changes; inspect diffs and undo only task-owned hunks. Do not reset/clean the working tree or delete `.data/shares`. Local test-state cleanup, if needed, must use a verified absolute path inside `.checks/cloudflare/test-state` and only after the harness has stopped its own process; preserving state is preferred for diagnosis.

Line-number drift is harmless when symbols/contracts match. Stop dependent work if existing production storage or share format differs, an expected binding/runtime API is unavailable, required package access cannot be obtained, account/route ownership is ambiguous, or verification fails without a diagnosed in-scope remedy. Do not spawn another AI agent to bypass restrictions. Deployment cannot proceed just because the local phase says READY.

## Copy-ready executor prompt

```text
Execute the local implementation phase S1–S8 of:
C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D\docs\plans\2026-10-26-durable-short-bouquet-links-implementation-plan.md

Work in C:\Users\user\Desktop\PROGRAMMING\Digital Boquet 3D at Light/low reasoning. Read the full plan and applicable AGENTS.md files and named skills first. Recheck HEAD, dirty files, sharing source/callers and deployment files before editing. The inspected baseline was main at 45e410cf5c7ad7620dacc20e46dd3ce0ed1cd7d9; preserve newer user work.

Implement the selected short-only creation flow, explicit error/Retry UI and independent Cloudflare Worker + D1 API in numbered dependency order. Keep existing Node service and old portable-link readers; preserve all gift data and current design. Never reintroduce automatic portable fallback, truncate URLs or remove photos. Use generated Worker binding types and the exact tooling preflight in the plan. Keep Worker emulation/database operations explicitly local.

Maintain the progress checklist, run checkpoint A and B and the S8 validation commands, and record actual evidence in docs/verification/2026-10-26-short-links.md. The prior sharing test had Windows temporary SSR-file ENOENT; distinguish loader blockers from assertion failures. Do not claim tests that did not execute passed. Stop dependent work for materially different contracts, unavailable required access/dependencies, or failures without a diagnosed scoped remedy.

S9 production activation is separately blocked: discover exact Cloudflare account/frontend project/route/database identities read-only and prepare concrete reviewable deployment details. Do not provision, migrate remote data, change routes/DNS, deploy/publish, create production test gifts, commit or push without current explicit authorization. Do not deploy the local-only config.

Finish with changed files, observed local test/build/browser/Worker persistence results, remaining limitations and incomplete steps. Clearly state whether the public domain was changed and verified. Local implementation alone does not fix the live site.
```
