# Shared gift logo confirmation

Implemented locally on 2026-10-28.

- Shared short links (`#s=`) and legacy portable links (`#b=`) hide both Remix bouquet buttons.
- The header logo opens a confirmation before the shared bouquet enters the studio and replaces the local draft.
- Stay with gift, Close and Escape preserve the gift, URL and saved draft, and return focus to the logo.
- The existing native dialog provides modal behavior. Its cleanup now closes before removal and restores the opener's focus.
- Logo activation waits until a saved gift finishes loading. Editor previews retain Back to studio.
- Existing sharing tests now enter the studio through the logo confirmation helper.

## Verification

- `npm run build`: passed.
- `npx eslint src/App.tsx tests/browser/shareHelpers.ts tests/browser/shared-logo.spec.ts`: passed.
- `npm test -- --maxWorkers=1 --testTimeout=30000`: 135/135 tests, 12/12 files passed.
- `npx playwright test tests/browser/shared-logo.spec.ts`: 4/4 passed, covering saved/portable links at 320px and 1280px, confirmation, cancellation, Escape, Close, focus restoration, background keyboard isolation, draft preservation, overflow and editor preview return.
- Existing `shared URLs reconstruct gifts in a fresh context and preserve the recipient’s draft until Remix` browser test passed after the application changes.
- Mobile and desktop modal screenshots visually reviewed in `artifacts/shared-logo/`.
- `git diff --check`: passed.

Test execution required localhost access outside the restricted sandbox and workspace-local temporary files. The default five-second timeout was exceeded by an existing geometry test during concurrent verification; the final unit run used a 30-second per-test timeout without changing repository test settings.

No deployment, commit or push performed. Physical-device and screen-reader speech checks were not performed.
