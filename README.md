# PetalPop 3D

A mobile-first, account-free 3D bouquet studio. All artwork is original procedural geometry. No database, credentials, model downloads, or runtime API calls are needed.

## Run locally

Use Node.js 24 and npm. On Windows:

```powershell
npm.cmd install
npm.cmd run dev
```

Vite prints the local URL. The development preview runs at `http://127.0.0.1:5180/`; the delivered production preview runs at `http://127.0.0.1:5181/`.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run preview
```

On macOS/Linux, use `npm`/`npx` without `.cmd`. The native config loader uses Node's TypeScript support. Windows Codex sandbox restrictions can affect esbuild dependency resolution; run the commands through the approved local execution path when testing inside that sandbox.

## Bouquet sharing

The URL contains a compressed, versioned configuration in `#b=…`. It includes the stable catalog IDs, quantities, colors, deterministic placement seed, size/spread, effects, palette, recipient, sender, and message. The fragment is processed in the browser. It is encoding, not encryption: anyone holding the link can view its content.

Opening a valid bouquet link takes precedence over local drafts and shows a gift reveal. Viewing a gift never overwrites the recipient's saved draft. Choosing **Remix** makes the gift their active local draft. Unknown versions and malformed links show an error while preserving saved work. Browser storage and clipboard denial have graceful fallbacks.

Localhost links work only on the machine running the app. To share across devices, upload the generated `dist/` folder to a static HTTPS host and create links from that hosted app. No backend or route rewrite is required for fragment links. Hosting, a public URL, and deployment have not been created.

## Catalog and controls

- 10 original flowers, 10 fillers, 10 wrappers, 10 ribbons, and 10 effects.
- Up to 5 flower types / 24 flowers and 3 filler types / 12 filler stems.
- One wrapper, one ribbon, and up to 2 optional effects.
- Six presets, six palettes, item colors, size/spread, seeded shuffle, and random generation.
- Optional names (50 Unicode code points each) and note (500 code points).
- Drag rotation, wheel/pinch zoom, reset, motion pause, and reduced-motion support.
- Quick grow/shrink edits, gentle independent stem sway, soft contact avoidance, and scattered drifting effects with fluttering butterfly wings.
- 1080×1080 PNG gift cards. Long notes are wrapped and whitespace is compacted to keep the entire note on the card; formatting is preserved in the interactive gift.

## Technical structure

- `src/config.ts`: validated portable state, compression, local drafts, palettes, presets.
- `src/layout.ts`: deterministic version-one placement.
- `src/models.ts`: thin botanical petal surfaces, spiral rose centers, hollow tulips, pollen, veined foliage, folded paper and fabric ribbons. Vertex colors preserve gradients while batching by material finish; repeated stems reuse model prototypes.
- `src/animation.ts`: cached instanced models, stable stem identities, edit transitions, stem/leaf attachments, and lightweight contact proxies.
- `src/effects.ts`: spaced particle placement, independent drifting paths, butterfly wing animation, and bounded particle batches.
- `src/Viewer.tsx`: lazy-loaded WebGL scene, gestures, adaptive rendering quality, visibility pauses, and full-detail export capture.
- `src/App.tsx` / `src/styles.css`: accessible responsive editor and gift flow.
- `public/catalog/` / `src/catalog-thumbnails.json`: pre-rendered catalog and preset-color thumbnails; opening the editor does not generate these models.
- `src/thumbnails.ts`: bounded on-demand fallback for custom colors. `npm.cmd run generate:catalog` refreshes the bundled images from the actual models while the development server runs on port 5180.
- `tests/`: state/model tests and real Chromium browser tests.

Keep version-one IDs and layout behavior stable. Introduce a new schema/arrangement version for incompatible future changes.

The redesigned catalog keeps all 50 IDs, saved bouquets, palettes and gift links compatible. Flowers use species-specific geometry; the intentionally playful Heart Bloom and Smiley Bloom remain decorative designs. The catalog and exported gifts use the same models. Translucent sleeves and bubbles retain their transparency in the automatic economy renderer.

All ten wrappers use the revised florist construction: a gathered waist, a short folded skirt, raised back sheets, a diagonal front overlap, and narrow turned hems. Pleated, tissue, origami, scalloped and petal finishes have distinct edges. The mini bag has a rounded opening, paper handles and tissue lining. Ribbon belts and projecting bows are fitted separately to the wrapper shape in both the animated scene and PNG exports.

Quantity edits update instance transforms without rebuilding every flower. The viewport uses lighter geometry and matte materials; PNG exports build the full-detail models on demand. The contact solver approximates flower heads and filler clusters, with bounded displacement to retain the bouquet's shape. It is soft visual contact avoidance rather than per-petal rigid-body simulation. Pause and reduced motion stop continuous animation; hidden tabs and offscreen previews stop scheduling frames.

## Evidence

Browser tests save desktop/mobile screenshots, the complete catalog contact sheet, PNG examples, and renderer metrics in `artifacts/`. Performance measurements identify their environment; a software GPU or emulated viewport is not evidence of physical-phone performance.

`artifacts/botanical-study.png` shows every flower from the front, side and back for geometry review.
`artifacts/wrapper-study.png` shows all ten wrappers on a bouquet from the front, side and back.
