# Pinned mobile studio and safe surprise companions

Implemented and verified locally on 2026-10-05. No deployment was performed.

## Behavior

- The mobile studio keeps one interactive canvas mounted above a separate controls scroller. Categories, palette, presets, surprise, export, history, object editing, and gift text remain available.
- The preview adapts to the visual viewport, including keyboard resizing. Short landscape screens use a preview on the left and scrolling controls on the right; landscape support extends to 1000px width at heights of 480px or less.
- Gift preview and desktop layouts restore ordinary scrolling. Arrange blooms/fillers and Done remain inside the shared studio layout.
- Surprise chooses 1–3 total companions and retains uploaded frame pictures and nonblank envelope notes. All personal items survive even when there are more than three, up to the existing six-object limit.
- Placement uses measured model bounds, ground offsets, bounded seeded candidates, and 0.12 units of clearance. Botanical bounds also allow for contact displacement and sway. New decorations can be reduced in size or omitted when space is tight; impossible personal layouts leave the current design unchanged.
- Successful surprises form one undo action. Existing draft and share formats remain compatible. Placement safeguards run during Surprise; manual placement remains user-controlled.

## Validation

- `npm.cmd test -- --maxWorkers 1 --testTimeout 30000`: 12 files, 119 tests passed. Geometry cases run separately to avoid aggregate timeouts on a busy machine.
- `npm.cmd run build`: TypeScript and production build passed.
- `npx.cmd eslint src tests scripts/generate-placement-bounds.mjs playwright.pinned.config.ts`: passed.
- `git diff --check`: passed.
- Six focused Chromium browser scenarios passed across the initial run and corrected targeted reruns using `playwright.pinned.config.ts` on port 5203. The full initial browser run was not clean: tests needed the current Arrange fillers action, a fixture installed before draft-loading, and the gift scene selector instead of the editor scene selector.
- Coverage includes the same canvas and rectangle during category changes and scrolling; visible changes before touch release; grouped undo; individual editing; draft reload; short and portable links; recipient notes; gift preview return; PNG download; 320–760px portrait views; 700px/844px short landscape views; simulated visual-viewport keyboard resize; desktop restoration; dialogs; and horizontal overflow.
- Screenshots, exported PNG, and workflow evidence are under `artifacts/pinned-studio/`; live touch evidence is under `artifacts/live-flower-editor/`.
- Repository-wide `npm.cmd run lint` still reports pre-existing errors in the separate `project-demo` sources and generated bundles. Those files were outside this change.

These are browser-emulation and local-rendering checks. Physical mobile keyboard behavior, device performance, and deployed operation were not verified.

## Maintaining bounds

After changing any botanical, wrapper, ribbon, or gift-object geometry, run `node scripts/generate-placement-bounds.mjs` and rerun the placement tests. The generated `src/placement-bounds.json` keeps model construction out of the Surprise interaction while retaining measured geometry dimensions.
