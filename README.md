# PetalPop 3D

A mobile-first, account-free 3D bouquet studio. All artwork is original procedural geometry. Editing works as a static app; an optional same-origin Node service saves gifts behind short links. No external account, database or credentials are needed.

## Run locally

Use Node.js 24 and npm. On Windows:

```powershell
npm.cmd install
npm.cmd run dev
```

Vite prints the local URL. Development defaults to `http://127.0.0.1:5180/`; the updated production preview runs at `http://127.0.0.1:5194/`.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run preview
# Serve the built app with durable short links:
npm.cmd start
```

On macOS/Linux, use `npm`/`npx` without `.cmd`. The native config loader uses Node's TypeScript support. Windows Codex sandbox restrictions can affect esbuild dependency resolution; run the commands through the approved local execution path when testing inside that sandbox.

## Bouquet sharing

Sharing prefers a tiny `#s=…` link with a random 16-character ID. The same-origin `/api/bouquets` service stores an immutable copy of the complete gift, including object placements, colors, original compact photos and crop settings. Later edits leave previously shared gifts unchanged. The sharing dialog waits for the latest text to be saved before enabling Copy or native sharing.

Vite development/preview include the service. For a built deployment, run `npm.cmd run build` then `npm.cmd start` with Node 24. Snapshots persist in `.data/shares/`, outside the public files and ignored by Git. Keep that directory on persistent storage when hosting or moving the service; losing it breaks its saved links. `SHARE_DATA_DIR` can select the persistent directory; `PORT` and `HOST` configure the listener (defaults: 5181 and 127.0.0.1). Storage is capped at 100 MB and creation at 120 requests/hour per IP. There is no external upload or third-party shortener.

On a static host or when the service is unavailable, sharing falls back to a compact, compressed portable configuration in `#b=c.…`. It carries the entire gift, so photo links remain longer. Existing `#b=…` links and version-one drafts still open. Anyone holding either kind of link can view its content; links are not encrypted.

The sharing dialog and Gift tab have synchronized **Title** and **Body** fields. The title becomes the opened gift's heading, with the recipient shown separately; the body appears in the letter. Both are included in PNG cards and the device's native share payload. Empty titles retain the existing default heading. The body retains the version-one `message` property so existing links and drafts keep their notes; missing titles migrate to an empty title without changing the schema version.

Opening a valid bouquet link takes precedence over local drafts and shows a gift reveal. Viewing a gift never overwrites the recipient's saved draft. Choosing **Remix** makes the gift their active local draft. Unknown versions and malformed links show an error while preserving saved work. Browser storage and clipboard denial have graceful fallbacks.

Localhost links work only on the machine running the app. Cross-device short links require hosting the built app and Node service on the same HTTPS origin, with persistent snapshot storage. Uploading only `dist/` to a static host supports portable links; it cannot resolve saved short links. Hosting, a public URL, and deployment have not been created.

## Catalog and controls

- 10 original flowers, 10 fillers, 10 wrappers, 10 ribbons, and 10 effects.
- Up to 5 flower types / 24 flowers and 3 filler types / 12 filler stems.
- **Flowers → Arrange blooms** offers a natural dome or a stepped bouquet with a lower front, balanced center and elevated back. Click a bloom in the scene or choose it from the list, then adjust its height, size, left/right position and depth. Edits stay attached to that flower through shuffle and are included in undo/redo, drafts, links, remixing and PNG exports. Removing a bloom clears its adjustments; per-flower and all-flower reset buttons are available.
- **Show bottom stems**, available in Arrange blooms and Wrap, reveals or hides the stem bundle below paper wrappers. The bag always keeps its stems enclosed and retains the paper-wrapper preference when switching back.
- In **Fillers → Arrange fillers**, **All fillers** adjusts height, size and spread; **One filler** adjusts height, size and left/right or back/front position. Select a numbered filler or tap its foliage in the preview, and reset its edits whenever needed. Filler spread multiplies the bouquet spread. Both flowers and fillers default to **Stepped**, with Natural available; settings persist through drafts, undo/redo, shuffle, shared gifts, remix and PNG cards. Mobile editing keeps the live preview visible while controls scroll.
- One wrapper, one ribbon, and up to 2 optional effects.
- Choose from 9 object designs: teddy bear, heart balloon, puppy, kitten, sealed letter, Memory Frame, Landscape Frame, Golden Frame and Snapshot Frame. A bouquet supports up to 6 movable instances. Use the Objects tab to add, select, drag, tap to place, rotate, resize, duplicate or remove each instance. Keyboard position controls are available.
- Click a sealed letter to bring its envelope forward, lift the flap and slide the paper out. Each envelope has its own note editor with four fonts, sizes 12–36, bold, italic, underline, text color and alignment. Select text to format it, then **Save & seal**. Notes allow 1,500 Unicode characters and persist in drafts, duplicates, remixing, saved short links and portable links. Shared gifts open a read-only letter; reduced motion and paused motion skip the reveal. PNG cards show the sealed envelope; interactive notes remain in the gift link.
- Frame pictures and object placements persist in drafts, shared gifts and PNG cards. Pictures are prepared as compact embedded JPEGs; see [GIFT-ASSETS.md](GIFT-ASSETS.md) for the model collection, controls, reference photographs and independent reviews.
- All four frame designs have **Portrait / Landscape** controls. The Landscape Frame starts wide; the others start upright. Orientation changes keep the original picture and crop settings, and persist through history, duplication, reload, sharing and remixing. Frame photos have a matching 4:5 or 5:4 crop preview, fit/fill, zoom, mouse/touch panning and keyboard arrows. The compact full source remains available for later cropping; the same crop renders in the scene and PNG.
- Labeled Color controls with swatches and palette icons for selected flowers, fillers, wrappers, ribbons and companion objects. Object tint changes reuse geometry.
- Undo/redo keeps up to 60 edits, grouping slider gestures, photo application and object drags. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Text fields retain native text editing shortcuts. History resets when opening another gift or draft.
- A direction guide identifies Front, Back, Left side or Right side and provides a Front view button to align the camera with the models' +Z face.
- Six presets, six palettes, item colors, size/spread, seeded shuffle, and random generation.
- Optional names (50 Unicode code points each), title (100 code points) and body (500 code points).
- Drag rotation, wheel/pinch zoom, reset, motion pause, and reduced-motion support.
- Quick grow/shrink edits, gentle independent stem sway, soft contact avoidance, and scattered drifting effects with fluttering butterfly wings.
- 1080×1080 PNG gift cards. Long notes are wrapped and whitespace is compacted to keep the entire note on the card; formatting is preserved in the interactive gift.

## Technical structure

- `src/config.ts`: validated portable state, compression, local drafts, palettes, presets.
- `src/flowerArrangement.ts` / `src/FlowerArrangementPanel.tsx`: stable bloom identities, bounded individual transforms, height presets and stem visibility. Arrangement state is optional, keeping existing version-one designs and twelve-field portable links compatible.
- `src/sharing.ts` / `server/`: compact link creation, saved-gift loading, immutable disk storage, Vite middleware and a production static/API server.
- `src/designHistory.ts` / `src/useDesignHistory.ts`: bounded grouped editing history.
- `src/PhotoCropEditor.tsx` / `src/objectPhotos.ts`: framed crop controls and shared photo placement math for the preview and export.
- `src/layout.ts`: deterministic version-one placement.
- `src/models.ts`: thin botanical petal surfaces, spiral rose centers, hollow tulips, pollen, veined foliage, folded paper and fabric ribbons. Vertex colors preserve gradients while batching by material finish; repeated stems reuse model prototypes.
- `src/animation.ts`: cached instanced models, stable stem identities, edit transitions, stem/leaf attachments, and lightweight contact proxies.
- `src/containment.ts`: cached collision fields sampled from the real wrapper walls, GPU stem/foliage contacts, and equivalent geometry deformation for PNG exports.
- `src/effects.ts`: spaced particle placement, independent drifting paths, butterfly wing animation, and bounded particle batches.
- `src/Viewer.tsx`: lazy-loaded WebGL scene, gestures, adaptive rendering quality, visibility pauses, and full-detail export capture.
- `src/giftModels.ts` / `src/giftCatalog.ts`: original object geometry, catalog metadata and validated instance placements. `src/ObjectLayer.tsx` / `src/objectScene.ts` handle drag placement and cached object rendering; `src/ObjectsPanel.tsx` / `src/objectPhotos.ts` provide editing and compact picture preparation.
- `src/EnvelopeNote.tsx` / `src/notes.css`: animated envelope reveal, accessible note dialog and rich text controls. `src/notes.ts` validates plain text and allowed formatting without storing or rendering arbitrary HTML.
- `src/App.tsx` / `src/styles.css`: accessible responsive editor and gift flow.
- `src/MobileStudioNav.tsx` / `src/mobile.css`: thumb-accessible Bouquet / Customize / Gift preview navigation, sticky mobile categories/history, natural page scrolling, and larger editing controls. Object placement jumps to the scene; Adjust returns to the selected object's controls. Gift preview returns to the previous studio position.
- Mobile **Arrange blooms** keeps the same live 3D canvas above a scrolling control panel, so adjustments remain visible. **All blooms** includes overall height, size and spread; **One bloom** adjusts the selected flower. Overall height preserves Natural dome / Stepped profiles and individual offsets, and persists through drafts, history, links, remix and PNG export. **Done** returns to flower selection.
- `public/catalog/` / `src/catalog-thumbnails.json`: pre-rendered catalog and preset-color thumbnails; opening the editor does not generate these models.
- `src/thumbnails.ts`: bounded on-demand fallback for custom colors. `npm.cmd run generate:catalog` refreshes the bundled images from the actual models while the development server runs on port 5180.
- `tests/`: state/model tests and real Chromium browser tests.

Keep version-one IDs and layout behavior stable. Introduce a new schema/arrangement version for incompatible future changes.

The redesigned catalog keeps all 50 IDs, saved bouquets, palettes and gift links compatible. Flowers use species-specific geometry; the intentionally playful Heart Bloom and Smiley Bloom remain decorative designs. The catalog and exported gifts use the same models. Translucent sleeves and bubbles retain their transparency in the automatic economy renderer.

All ten wrappers use the revised florist construction: a gathered waist, a short folded skirt, raised back sheets, a diagonal front overlap, and narrow turned hems. Pleated, tissue, origami, scalloped and petal finishes have distinct edges. The mini bag has a rounded opening, paper handles and tissue lining. Ribbon belts and projecting bows are fitted separately to the wrapper shape in both the animated scene and PNG exports.

Quantity edits update instance transforms without rebuilding every flower. The viewport uses lighter geometry and matte materials; PNG exports build the full-detail models on demand. The contact solver approximates flower heads and filler clusters, with bounded displacement to retain the bouquet's shape. It is soft visual contact avoidance rather than per-petal rigid-body simulation. Pause and reduced motion stop continuous animation; hidden tabs and offscreen previews stop scheduling frames.

At maximum spread, stems and lower foliage bend inside the paper and emerge through each style's opening. The boundary follows the actual wall triangles, including asymmetric rims, pleats and the rounded rectangular bag. A small polar field is cached per wrapper style and applied in the vertex shader during sway and grow/shrink transitions; quantity edits do not rebuild collision geometry. PNG exports bake the same contacts into full-detail botanical meshes. Saved layouts and spread values remain unchanged.

## Evidence

Browser tests save desktop/mobile screenshots, the complete catalog contact sheet, PNG examples, and renderer metrics in `artifacts/`. Performance measurements identify their environment; a software GPU or emulated viewport is not evidence of physical-phone performance.

`artifacts/botanical-study.png` shows every flower from the front, side and back for geometry review.
`artifacts/wrapper-study.png` shows all ten wrappers on a bouquet from the front, side and back.
`artifacts/wrapper-contacts-study.png` reviews all ten styles at maximum size/spread with 24 flowers and 12 fillers, alongside their full-detail export geometry.
