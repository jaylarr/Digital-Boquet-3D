# Movable object integration verification

Verified locally on 2026-10-04 in Chromium with the SwiftShader software GPU. Mobile interaction uses an emulated 390×844 touch viewport; this is not a physical-device performance measurement.

## Result

All five requested models are available in the editor's Objects tab. Up to six independent instances support mouse/touch dragging, tap placement, position/height/depth sliders, yaw rotation, scale, duplication and removal. Custom standing-frame pictures and placements persist in drafts, reconstructed shared gifts, remixes and PNG cards.

The independent reviewer visually inspected the integrated editor, shared gift, PNG and mobile captures, retaining scores of teddy 8/10, balloon 7/10, puppy 8/10, kitten 7/10 and frame 8/10. Every model meets the requested minimum of 7. See `independent-integration-review.md` and the earlier four-view geometry review at `../gift-models/independent-review.md`.

## Checks completed

- `npm.cmd test -- --maxWorkers=1`: 55 tests passed across five files, including portable object state, legacy migration and input validation.
- Two object browser tests passed: actual mouse dragging, tap placement, precise transforms, five model additions, custom landscape picture fitting, reload, fresh-recipient sharing, PNG, remix, six-object limit, removal, mobile overflow, actual touch dragging, keyboard adjustment, ground placement and an object-only PNG.
- Nine existing app browser checks passed across the regression run and targeted rerun. They cover the original 50-item catalog, responsive layouts, quantity limits, keyboard tabs, palettes/presets, gift text/native share, fresh-recipient draft preservation, malformed/future links, PNG text, unavailable WebGL/storage/clipboard, bounded botanical rendering and camera/pinch gestures.
- A regression initially detected differing JSON property order after draft validation. The validated object's property order was aligned with the starter configuration, preserving serialized draft stability; the malformed/future-link test passed on rerun.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed, including TypeScript compilation and both Vite entries.
- `node scripts/verify-object-production.mjs`: passed against the built app at `http://127.0.0.1:5191`, including all five additions, custom picture upload, keyboard resizing, tap placement, reload, fresh-recipient gift, PNG download, matching remix and the separate asset-study page. No browser errors were recorded.

## Captured evidence

`validation.json` records object transforms and renderer counts before/after moving, turning and resizing a teddy. Botanical model builds remained 4 and object builds remained 1, demonstrating that these placement edits reuse the geometry.

`editor-desktop.png`, `editor-mobile.png`, `shared-gift.png`, `gift-card.png` and `object-only-card.png` capture the functional browser tests. Preview framing and PNG capture were corrected after an early screenshot clipped foreground paws. The implementation agent and independent reviewer inspected the final integrated shared gift and PNG, where every object fits with margins.

`production-validation.json`, `production-editor.png`, `production-gift.png` and `production-card.png` record the built-app verification. The implementation agent visually inspected the production gift and card; all five objects and the custom picture are present, with complete outer silhouettes.

## Boundaries

The implementation is local and has not been deployed. Pictures are resized to compact embedded JPEGs; the full aspect ratio is preserved, but their resolution is reduced. The tested picture links were approximately 9 KB; complex pictures can create longer links. Localhost gift links require the local server. The models are static geometry with editable placement, not physically simulated objects; placement overlaps are allowed.
