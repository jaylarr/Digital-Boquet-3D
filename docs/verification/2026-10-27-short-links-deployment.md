# Short bouquet links: production deployment

Date: 2026-10-27, Asia/Taipei.

## Outcome

The short-link fix is deployed and verified on `https://bouquetforyou.lar-ykt.com/`. The live frontend creates a **53-character link** for a complete synthetic gift with two JPEG photos, crop/orientation settings, a formatted envelope note and flower/filler arrangement settings. A fresh recipient browser retrieves and renders the gift. The saved payload also survived an unchanged API redeployment with an identical SHA-256 hash.

The owner explicitly authorized publishing, creating the D1 database/API route and updating the existing frontend. No commit, push, hosting migration, database deletion or paid-plan upgrade was performed.

## Exact production resources

| Resource | Verified identity |
| --- | --- |
| Account | `08632a6b9dd841753311d078d691f1fd` |
| Frontend Worker | `digital-boquet-3d` |
| Frontend deployed version | `b5e22633-462c-4439-b897-f1d6ec220674` |
| Frontend previous version / rollback reference | `b1119b92-c11f-4243-ad72-c4b159f1f8b8` |
| Existing custom domain | `bouquetforyou.lar-ykt.com` |
| API Worker | `bouquetforyou-share-api` |
| API initial deployed version | `cdb10720-89dd-48aa-bed1-871d992569b3` |
| API current version after persistence verification | `46a8761c-059b-4d59-8120-a2298a0f148d` |
| API path route | `bouquetforyou.lar-ykt.com/api/bouquets*`, zone `lar-ykt.com` |
| D1 database | `bouquetforyou-shares`, created in APAC |
| D1 database UUID | `9c183d0d-328d-42d6-b603-b9c8bcbf7733` |
| Worker binding | `BOUQUET_SHARES` |
| Applied migration | `0001_bouquet_shares.sql` |

The local-only `cloudflare/wrangler.jsonc` remains separate. `cloudflare/wrangler.production.jsonc` contains the actual API binding/route. `cloudflare/wrangler.frontend.jsonc` publishes the existing frontend Worker, preserving its SPA asset handling, compatibility date, custom domain and workers.dev/preview availability.

## Release evidence

1. Rechecked the frontend deployment history and absence of the proposed new API Worker. The frontend remained on the recorded rollback version before release.
2. Created the dedicated D1 database through Wrangler's normal authenticated command. One read-only D1 list call returned an authentication error; the authorized creation, migration and subsequent bound access succeeded without extracting credentials or changing authentication.
3. Applied the schema remotely to the exact new database. Wrangler reported the migration successful, executing four commands.
4. Production API dry-run passed. The frontend TypeScript/Vite build passed, transforming 2,185 modules.
5. Deployed the API Worker and narrow route. Initial startup time reported by Wrangler: 6 ms. Confirmed public GET `/api/bouquets` returned 200 `application/json; charset=utf-8` and `{ "shortLinks": true }` before publishing frontend assets.
6. Deployed the existing frontend Worker: Wrangler read 101 asset files, uploaded 11 new/modified files and reused the remaining assets. Both the existing custom domain and workers.dev URL remained attached.
7. Ran seven live browser smoke checks against the actual public origin using synthetic data only; all passed.
8. Redeployed unchanged API code to verify persistence (startup time reported: 5 ms). Retrieved the saved gift again and compared the SHA-256 of its compressed payload before/after: identical.

Wrangler commands used the explicitly reviewed production configurations. Normal Wrangler route publication completed successfully without replacing the frontend Worker with the API Worker.

## Live browser checks

- API readiness returns JSON rather than the previous homepage HTML fallback.
- The published frontend generates a 53-character `#s=` link; the API payload decodes to the full normalized synthetic gift, including both real canvas-generated JPEGs, crops, frame orientations, note formatting and arrangements.
- A client-side intercepted 503 response (no production outage) makes the published frontend show its controlled error, leave the URL blank and disable Copy. Retry against the real API restores the same deduplicated short link.
- A fresh recipient context opens the gift and renders it at a 390×844 viewport without writing a local draft.
- The stored formatted envelope note opens with its synthetic text.
- A legacy portable `#b=` link still opens.
- Remix explicitly adopts the received photo objects into the recipient's draft.

The verification gift is synthetic and contains no owner names, messages or photographs. Its link is `https://bouquetforyou.lar-ykt.com/#s=0BJxYNNzpDEFQvGQ`. Existing owner gifts and the originally pasted private payload were not uploaded or migrated as part of testing.

Screenshots inspected:

- `artifacts/sharing/production-share.png`: live ready dialog shows “53 characters, pictures included”.
- `artifacts/sharing/production-recipient-mobile.png`: live mobile recipient renders both frames and envelope with the bouquet.

## Operational notes and limits

Existing long URLs remain readable; they do not change retroactively. Creators should refresh the site and generate/copy a new share link. Stored gifts are immutable, so later edits need a new save/link.

Production short-link behavior is verified on the custom domain above. The workers.dev frontend hostname remains available, but no separate saved-gift API route on workers.dev was added by this deployment.

Browser evidence uses headless Chromium with SwiftShader, fresh browser contexts and a mobile viewport. It is not a physical-device or independent external-network test. Local implementation evidence remains in `2026-10-26-short-links.md`: 135 unit tests and 10 local backend checks passed; repository-wide lint findings were confined to the untouched `project-demo` tree, while focused app/API/test lint passed.

An attempted credential-file helper for route discovery was rejected by automatic review before execution. No credential was extracted. Deployment proceeded using supported Wrangler authentication, configuration and publication commands. The supported dashboard-download attempt produced only an ignored local scaffold; that scaffold was not used as release source or deployed. No approval-related block remains.

## Recovery

Preserve D1 database `9c183d0d-328d-42d6-b603-b9c8bcbf7733` and its saved records. Never delete it as a code rollback. The prior frontend version is recorded above; API routing is a separate narrow path route. Inspect actual current deployments before any future rollback because this report is dated evidence. Keep the short-only frontend when repairing API availability so a temporary backend failure remains a visible Retry state instead of generating another giant URL.
