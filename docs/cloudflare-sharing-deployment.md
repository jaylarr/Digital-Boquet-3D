# Cloudflare short-link activation

Status on 2026-10-27: **deployed and verified on the public custom domain**, after explicit owner authorization. See `verification/2026-10-27-short-links-deployment.md` for resource/version IDs and live evidence. The preflight and release procedure below are retained as dated setup context; they no longer describe pending activation.

## Pre-release snapshot (2026-10-26)

- Public origin: `https://bouquetforyou.lar-ykt.com/`.
- Read-only GET to `/` returned 200 HTML. GET to `/api/bouquets` also returned 200 HTML containing the homepage document. A JSON short-link API is not handling that path.
- Repository: `jaylarr/Digital-Boquet-3D`, branch `main` at inspected base `45e410cf5c7ad7620dacc20e46dd3ce0ed1cd7d9`.
- Wrangler is authenticated to account `08632a6b9dd841753311d078d691f1fd`. Do not assume a valid login proves ownership of the domain's application.
- Read-only Pages project listing did not identify a bouquet project. Read-only D1 listing returned no databases in the connected account.
- The owner's Domains screenshot identifies frontend Worker **`digital-boquet-3d`**, workers.dev hostname `digital-boquet-3d.arjayemmanuell.workers.dev`, and custom domain `bouquetforyou.lar-ykt.com` in zone `lar-ykt.com`. Both production workers.dev and preview URLs are enabled.
- Read-only `wrangler deployments list --name digital-boquet-3d` confirms the Worker exists in the connected account. Current deployment is version **`b1119b92-c11f-4243-ad72-c4b159f1f8b8`**, created 2026-10-05T12:51:28.511Z. Record this as the frontend rollback version; inspect again immediately before release in case it changes.
- Read-only version inspection reports no application bindings, no fetch handler, compatibility date `2026-10-01`, and assets with `not_found_handling: single-page-application`, `serve_directly: true`, and base path `/`. This is a static-assets Worker. No previous D1 binding or saved-gift handler is being replaced.
- The exact zone UUID and overlapping API path routes must still be checked immediately before activation. The domain and its zone name are established by the owner's screenshot, not guessed from repository naming.

## Prepared resources

The selected addition is a separate **API-only** Worker, `bouquetforyou-share-api`, with D1 database `bouquetforyou-shares` bound as `BOUQUET_SHARES`. Its intended route is `bouquetforyou.lar-ykt.com/api/bouquets*` in the `lar-ykt.com` zone. Keep HTML and assets on the existing origin. Names above are proposed new resources, not claims that they exist.

`cloudflare/wrangler.jsonc` is for local development, migration and dry-run only. It deliberately has no account, remote database ID or route. Do not deploy it or rely on automatic resource provisioning. Its `remote:false` binding keeps development on local D1.

## Activation preflight and release order

The frontend identity, current release, static asset configuration and absence of application bindings are now verified above. Immediately before release, recheck that deployment and inspect overlapping `/api/bouquets*` routes in the verified zone. If unexpected pre-existing storage or another API owner is discovered, stop for a preservation/import decision instead of replacing it.

`cloudflare/wrangler.frontend.jsonc` is a concrete release configuration for the existing `digital-boquet-3d` frontend. It preserves the observed SPA asset fallback, compatibility date, workers.dev/preview availability and existing custom domain. It is separate from the API's local development configuration. Preparing or dry-running it does not publish changes.

After the local result is reviewed and production activation is explicitly authorized:

1. Create the dedicated D1 database in the verified account with `npm.cmd exec wrangler -- d1 create bouquetforyou-shares`. Retain its returned database UUID; do not invent it or reuse another project's store.
2. Create `cloudflare/wrangler.production.jsonc` from the local config. Set the verified account ID and returned database ID, remove `remote:false`, keep the same binding and migration directory, and add only the narrow API route in the verified `lar-ykt.com` zone. Do not use `custom_domain:true` for this path route or take over the whole frontend hostname. Inspect the complete config before running a remote command.
3. Apply the new schema to that exact database: `npm.cmd exec wrangler -- d1 migrations apply BOUQUET_SHARES --remote --config cloudflare/wrangler.production.jsonc`.
4. Deploy only the API Worker: `npm.cmd exec wrangler -- deploy --config cloudflare/wrangler.production.jsonc`. Verify readiness JSON before publishing the frontend. Outside the exact API contracts the Worker returns JSON 404; it never fetches itself.
5. Build with `npm.cmd run build`, dry-run `npm.cmd exec wrangler -- deploy --dry-run --config cloudflare/wrangler.frontend.jsonc`, and publish the updated frontend to the **existing verified Worker** with `npm.cmd exec wrangler -- deploy --config cloudflare/wrangler.frontend.jsonc`. Do not move the site to another Pages project or replace it with the API Worker. The narrow API route must already return readiness JSON before this frontend step.
6. Verify the actual production origin with GET readiness, then one explicitly authorized synthetic gift POST/GET. A valid root-domain link must be 53 characters, including two test photos and formatted envelope notes in storage. Open it in a fresh recipient browser and, if available, another device/network. Confirm original app assets still load and viewing does not change the recipient's draft. Report physical-device testing separately.
7. Verify saved link access after a controlled Worker redeployment. Keep synthetic data separate from private gifts; do not create an artificial production outage to test the failure UI.

These actions were executed on 2026-10-27 after explicit owner authorization. The production database UUID is `9c183d0d-328d-42d6-b603-b9c8bcbf7733`; the actual API configuration is saved as `cloudflare/wrangler.production.jsonc`.

## Operational behavior and recovery

- API request limit: 190,000 bytes, including streamed/chunked requests. Existing bouquet/photo/note validation remains authoritative.
- D1 records store a validated compressed payload, SHA-256 digest and a cryptographic 16-character random code. Existing codes are immutable and do not expire.
- Payload-accounting capacity is 100 MiB. It is not a claim about D1's physical storage limit or billing size. Identical saves still deduplicate when at capacity. Capacity exhaustion returns 507 and a visible frontend error.
- Creation is limited to 120 valid save attempts per client per rolling hour, persisted in D1. The trusted Cloudflare client address is hashed for its operational bucket; raw addresses/gift contents are not logged. Reads do not consume creation quota.
- API responses use JSON, no-store and nosniff. Foreign Origin requests are rejected. No browser database credentials or cross-origin API are introduced.
- Store and preserve the real database UUID with deployment records. Back up D1 through the account's normal database backup process; do not delete D1 on code rollback.
- If activation fails, restore only task-owned route/code changes to recorded earlier versions. Preserve the database and every saved gift. Prefer keeping the new short-only frontend with a visible Retry error while repairing the API, since rolling back the frontend reintroduces the huge-link fallback.
- `server/` remains the supported local/standalone Node disk service. Existing `.data/shares` is untouched. Legacy `#b=` links remain readable in both deployments.
