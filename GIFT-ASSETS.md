# Little extras — original 3D object collection

Nine original reusable models are integrated into the bouquet editor's **Objects** tab, local drafts, shared gifts and PNG cards. The separate asset studio and standalone GLB exports are also available.

## Place objects in your bouquet

Open the main editor and choose **Objects**. Add a teddy, heart balloon, puppy, kitten, one of four photo frames or a sealed letter; a bouquet supports up to six instances, including repeated models. Click or tap an object to select it, then drag it across the preview. Dragging the background rotates the camera. **Tap a spot to place** shows a placement grid at the object's chosen height. Sliders provide precise left/right, height, depth, rotation and size controls; they work with the keyboard too. Each instance can be duplicated or removed independently.

Click a Sealed Letter to open its wax-sealed envelope and lift the paper into a note dialog. In the studio, write up to 1,500 characters and format selected text using fonts, size, bold, italic, underline, color and alignment. **Save & seal** commits the note as one undoable design edit. Closing without saving cancels the edit. Every envelope has an independent note that persists in drafts, shared snapshots and remixes; duplicating a letter copies its note. Gift recipients see a read-only letter, accessible by clicking the 3D envelope or its **Open your letter** button. Reduced motion and paused motion skip the opening animation. The GLB and PNG card contain the closed envelope; the interactive note belongs to the bouquet configuration.

Select any frame and choose **Portrait** or **Landscape**, then a JPG, PNG or WebP picture up to 15 MB. Memory Frame has warm oak, Landscape Frame has darker oak and starts wide, Golden Frame has metallic rails and corner details, and Snapshot Frame has an ivory instant-photo border. Every design supports both orientations, with a 4:5 portrait or 5:4 landscape photo aperture. Changing orientation retains the compact original picture and normalized crop so you can adjust it again. Pictures and object settings survive reload, duplication, undo/redo, shared gifts, remixing and PNG cards. Pictures are prepared on-device and included in the immutable saved gift or portable link. Anyone holding a gift link can view its pictures. A layout may contain objects with no flowers.

Placement uses bounded coordinates rather than physics. Objects may overlap if you place them together. Moving, rotating or resizing reuses the existing geometry and does not rebuild flowers. Old version-one gifts and drafts migrate with an empty object list.

Open `/asset-study.html` on the running preview. Rotate/zoom models, choose front/three-quarter/side/back, upload a custom picture to any frame, or download the selected model. The separate study page uses each model's default orientation; the main bouquet editor provides orientation controls. In the study page, choosing another object restores the sample picture and uploads are temporary previews. Downloading a custom frame embeds its picture into that GLB. The main editor saves its frame pictures with the bouquet instead.

## Models

| ID | Features | Download |
| --- | --- | --- |
| `teddy-bear` | Cream seated plush, muzzle, button eyes, satin bow, stitched belly and paw pads | `public/models/teddy-bear.glb` |
| `heart-balloon` | Inflated rose foil heart, perimeter seal, crinkles, valve, tied curling string and weight | `public/models/heart-balloon.glb` |
| `cute-puppy` | Golden retriever figurine, drooping ears, snout, tongue, collar/tag, paws and tail | `public/models/cute-puppy.glb` |
| `cute-kitten` | Ginger figurine, pointed pink ears, tabby details, whiskers, bow, paws and curved tail | `public/models/cute-kitten.glb` |
| `standing-frame` | Oak border, metallic inner trim, cream mat, replaceable picture, backing/clips, hinged rear easel and retaining stay | `public/models/standing-frame.glb` |
| `sealed-envelope` | Folded paper, front seams, raised rose wax seal and embossed heart; opens a formatted note in the bouquet studio | `public/models/sealed-envelope.glb` |
| `landscape-frame` | Wide oak rails, cream mat, metallic inner trim, replaceable landscape photo and rear easel | `public/models/landscape-frame.glb` |
| `golden-frame` | Gold metallic rails, inset trim, corner studs, cream mat, replaceable photo and rear easel | `public/models/golden-frame.glb` |
| `snapshot-frame` | Ivory instant-photo silhouette, generous bottom border, inner bevel, replaceable photo and rear easel | `public/models/snapshot-frame.glb` |

All are original procedural meshes. The first five companion models follow the real photographs documented in `artifacts/gift-asset-references.md`; the envelope and three additional frame designs use original geometry. Reference photographs are private study artifacts and are not production assets. These are stylized static models, not scanned or rigged models. Y is up; front is +Z; floor is Y=0. The balloon is grounded by its string weight. Relative dimensions, file sizes and rendering metrics are in `public/models/manifest.json`.

## Reuse in Three.js

```ts
import { createGiftModel, disposeGiftModel, photoTextureFromFile } from './src/giftModels';

const teddy = createGiftModel('teddy-bear', { color: '#dcc6a4' });
scene.add(teddy);

const texture = await photoTextureFromFile(file);
const frame = createGiftModel('standing-frame', { photo: texture });
scene.add(frame);

// When removing a model, dispose its owned geometry, materials and photo texture.
scene.remove(frame);
disposeGiftModel(frame);
```

The image mesh is named `photo-surface`, with a 4:5 portrait or 5:4 landscape aperture. Pass `frameOrientation: 'landscape'` to `createGiftModel`, and the matching aspect ratio to `photoTextureFromFile(file, 1.25)` when preparing a landscape texture. JPG, PNG and WebP files up to 15 MB are fitted with letterboxing as needed, preserving the whole picture and aspect ratio. Sample imagery is an original canvas landscape. Photos use an unlit material to preserve readable colors. Model ownership includes the passed texture; use a separate texture per model. Foil appearance benefits from a Three.js environment map. Exported GLB retains standard materials, vertex colors and the unlit photo material, without external texture requests.

The studio is a separate Vite entry and renders on interaction rather than an idle animation loop. Meshes are batched by material, with indexed geometry to keep GLBs compact. No new package dependencies were added.

## Regenerate and verify

```powershell
npm.cmd run dev -- --port 5190 --strictPort
# In another terminal:
node scripts/generate-gift-assets.mjs
npm.cmd exec -- playwright test --config playwright.assets.config.ts
npm.cmd exec -- playwright test --config playwright.objects.config.ts
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The generator writes GLBs, thumbnails and four-view render studies and reopens each GLB to compare geometry bounds. Browser verification exercises object selection, all view buttons, custom image upload, embedded-picture GLB download/reload, invalid-file recovery and a 390-pixel mobile viewport. `artifacts/gift-models/` contains the rendered study, upload/export evidence and the independent agent review. Software-GPU renders and emulated mobile checks are local evidence.

`artifacts/objects/` contains the integrated editor, shared gift, PNG and mobile evidence. Integration tests exercise actual mouse/touch dragging, tap placement, transform reuse, keyboard adjustments, picture upload, draft reload, fresh-recipient sharing, remixing, duplication/removal and object-only PNG export. The independent review rates the final models **8/10 teddy, 7/10 balloon, 8/10 puppy, 7/10 kitten and 8/10 frame**; each meets the requested minimum of 7. The reviewer also inspected the integrated shared gift and PNG to confirm that every object fits.

The built-app check is `node scripts/verify-object-production.mjs` while the production preview runs on port 5191. [Integration validation](artifacts/objects/VALIDATION.md) records the checks and their evidence.

## Integrated photo crop editor

The bouquet builder's Objects tab provides a framed crop preview matching the selected orientation, with Fit whole picture, Fill the frame, zoom, pointer panning and keyboard arrows. The small JPEG source is retained separately from its normalized crop settings, allowing later recropping. Crop parameters, orientation and object colors persist in drafts and both link formats; the object renderer and PNG exporter use the same photo-placement math. Applying a crop is one undoable edit, and cancelling leaves the prior picture untouched. See artifacts/studio/ for the original crop and history checks, and artifacts/frames/ for all four frame designs and both orientations.
