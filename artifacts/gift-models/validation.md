# Gift model validation — 2026-10-04

Model phase complete: five original static models, separate asset studio, five indexed GLB files, replaceable photo surface and download flow. The bouquet editor catalog/configuration has not been extended with these objects.

- Independent reviewer visually inspected real references, all five four-view model studies, original and reopened custom-picture previews, and the refreshed mobile layout. Final ratings: teddy 8, balloon 7, puppy 8, kitten 7, frame 8. See `independent-review.md`.
- `node scripts/generate-gift-assets.mjs`: passed. All five exported GLBs reopened through GLTFLoader with matching bounds. Final files are approximately 0.59–1.17 MB; 7–17 material batches, 12,214–34,512 triangles. Origin/floor is Y=0.
- `npm.cmd test -- --maxWorkers=1`: 50 tests passed across four files. A prior concurrent run timed out in three existing bouquet/wrapper tests under the 5-second limit while software-GPU browser checks were active. The sequential rerun passed without changing their tests or timeout thresholds.
- `npm.cmd exec -- playwright test --config playwright.assets.config.ts`: passed after the mobile control-strip adjustment. Exercises all five selections and model views, image fitting, photo embedded in the custom GLB, GLTFLoader reload, reset/error recovery, and mobile overflow. Artifacts include `custom-picture-front.png`, `custom-frame-reloaded.png` and `studio-mobile.png`.
- `npm.cmd run lint`: passed.
- Final `npm.cmd run build`: passed (includes TypeScript). Outputs both original bouquet entry and `asset-study.html`.
- Production preview at `http://127.0.0.1:5191`: all five models selectable, all thumbnails and GLB downloads return successfully, custom photo upload/download embeds the picture, original bouquet entry renders, no browser page errors. See `production-check.json` and `production-studio.png`.

The live development preview used port 5190 after the older port 5180 server returned stale optimized dependency files. Local preview startup and public reference downloads used approved expanded execution access. Verification uses Chromium's software GPU and a 390-pixel emulated viewport. These are local preview/export checks, not physical-device, hosted-site or cross-engine certification.
