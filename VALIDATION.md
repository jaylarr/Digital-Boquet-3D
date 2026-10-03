# Local validation — October 3, 2026

- Production build and TypeScript check passed.
- ESLint passed without warnings.
- 31 unit tests passed, including vertex-color gradients, transparent/opaque material separation, maximum bouquets for every flower species, cache reuse, rapid grow/shrink edits, independent sway, bounded cache disposal, deterministic soft contacts, and spaced effect placement.
- 13 Chromium browser tests passed, including all 50 redesigned catalog variants, front/side/back flower and wrapper renders, 320/390/768/1280px layouts, quantity/type limits, palettes and presets, keyboard tabs, gift URL restoration in a fresh context, recipient-draft preservation, malformed-link recovery, 1080-square PNG downloads, maximum-length Unicode notes, browser-storage/clipboard/WebGL fallbacks, mouse rotation/zoom/reset, and simulated mobile pinch without page scrolling. Dedicated animation checks verify cached quantity edits, pause/resume, scattered butterflies/fireflies, and instant reduced-motion edits. All ten wrapper changes reuse cached flower prototypes, stay below 20 draw calls and 45,000 triangles for the standard review bouquet, and render without page errors.
- Existing catalog IDs, configuration schema and deterministic placement remain compatible with saved designs and gift links.
- Production preview on port 5181 was checked separately: the rebuilt 3D scene loaded, the PNG control was visible, all 10 wrapper thumbnails decoded, and no page errors occurred. The user's open preview was refreshed. Latest screenshot: `artifacts/production-wrappers.png`.

## Asset redesign

All 50 procedural assets were rebuilt. Botanical flowers use thin, curved petal surfaces instead of ellipsoid clusters: layered roses with spiral centers, six-tepal tulip cups, fine daisy rays, sunflower seed discs, ruffled peonies, recurved lilies with stamens, lavender florets and clustered four-petal hydrangeas. Foliage includes veined and lobed leaves, fine branching, wheat awns and bunny-tail fibers. Wrappers use overlapping sheets, ribbons use twisting fabric strips, and decorative effects have new silhouettes and material finishes. Lighting and 224px catalog thumbnails were updated together.

The subsequent wrapper refinement rebuilds all ten styles around a gathered waist and a short curved skirt, with raised back sheets, asymmetric front overlaps and turned hems. Pleats, soft tissue layers, angular origami folds, scalloped edges and petal lobes retain distinct silhouettes. The gift bag has a rounded, wider opening, tissue lining and paper handles. Ribbon belts are centered independently of projecting bow loops; the same fitting is used in live rendering and PNG export. Bundled thumbnails were regenerated from the final geometry. `artifacts/wrapper-study.png` records every style from three angles on the standard bouquet.

## Performance bounds and limitations

The recorded dense scene has 24 hydrangeas, 12 baby's-breath stems, butterflies and a rainbow halo. After the wrapper refinement it uses **15 draw calls and 80,016 triangles**, compared with 9 calls and 145,648 triangles before the animation/performance pass. Independent butterfly wings and stem batches increase draw calls while reducing triangle work by approximately **45%**. The browser test uses headless Chromium with **SwiftShader software rendering**, a 390×844 viewport, and automatic economy materials / 0.6 pixel ratio. The latest sample is approximately **10.2 FPS**; it does **not** establish the 30-FPS physical-phone target. No physical Android/iOS device was available for this run. Real-device performance remains to be checked; the exact software-renderer measurement is in `artifacts/performance.json`.

The same 12 warm, alternating Rose quantity edits were measured before and after at 1280×960 with motion paused. The latest isolated run after the wrapper refinement includes the React commit and two animation frames: median latency was **38.9 ms**, compared with the original 193.8 ms, and maximum latency was 45.3 ms versus 325.3 ms. Warm model-update CPU time was **0.1 ms**, with four cached prototypes reused through all 12 edits. First-time prototype construction still costs CPU time; the measured initial model update was 70.9 ms. Local timings vary with other GPU/CPU activity and are not a guarantee of real-device responsiveness. Reports and the repeatable benchmark are in `artifacts/edit-performance-before.json`, `artifacts/edit-performance-after.json`, and `artifacts/profile-edits.mjs`.

Rendering optimizations include cached instanced heads/stems/leaves, stable stem identity during edits, lighter viewport geometry, indexed geometry, vertex-color batching by material finish, 65 bundled catalog/preset-color thumbnails, a bounded custom-color fallback, lazy-loaded 3D code, bounded particles, demand rendering, hidden-tab/offscreen pauses, and adaptive cheaper materials/resolution. Full-detail models are built only for explicit PNG capture. The economy conversion preserves vertex colors and transparency. Application JavaScript is approximately 345 KB gzipped across the split bundles; CSS is approximately 5.5 KB gzipped.

Flowers and fillers have independent gentle sway, nodding heads, and attached stems/leaves. Grow/shrink transitions last roughly 0.2 seconds, with arrangement settling around 0.4 seconds. Collisions use inexpensive head/foliage proxies and bounded separation; dense bouquets may retain some petal overlap. Effects use independent spaced positions and drifting paths instead of a common circular orbit. Butterflies have separately animated wings; fireflies are warm glowing sparkles rather than dark insect silhouettes.

## Review artifacts

- `artifacts/desktop.png` and `artifacts/mobile.png`: actual editor screenshots.
- `artifacts/catalog.png`: all 50 original variants rendered from their real 3D geometry.
- `artifacts/botanical-study.png`: front, side and back views of all 10 flower models.
- `artifacts/gift-card.png`: a normal personalized gift-card download.
- `artifacts/gift-card-long-note.png`: the complete maximum-length Unicode note and names.
- `artifacts/maximum-mobile.png`: the maximum bouquet, with its halo fitted into the preview.
- `artifacts/scattered-effects.png`: the spaced butterfly and firefly treatment.
- `artifacts/production-polish.png`: the rebuilt production editor.
- `artifacts/production-wrappers.png`: the final wrapper preview and regenerated catalog in the production editor.
- `artifacts/wrapper-study.png`: all ten wrappers on a bouquet from the front, side and back.
- `playwright-report/index.html`: complete browser-test report.

Everything remains local. No deployment, public host, account, database, email, or external publishing action was performed. Share links created on localhost only become cross-device links after the static app is hosted and links are created from that hosted address.
