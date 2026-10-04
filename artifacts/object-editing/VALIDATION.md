# Object placement and frame picture dialog

Verified locally on October 4, 2026. These checks do not establish deployment or public availability.

## Behavior

- Objects, selection markers, placement gestures, and the edit grid use a shared ground. Exposed stems lower that ground; a gift bag or an object-only design keeps the original base.
- Saved object coordinates remain compatible. Height offsets above the floor survive stem toggles, drafts, links, and exports without geometry rebuilds.
- The ground grid remains visible throughout editing, including before adding objects. Gift viewing and PNG capture hide it.
- Dragging an unselected object rotates the camera. A completed click selects it for a subsequent drag. Selecting from the object list also enables dragging.
- Adding any of the four frame designs immediately opens a frame preview with Change picture and Keep sample picture. Closing or pressing Escape retains the frame. Canceling a crop returns to the chooser; applying it saves the picture and closes both dialogs.
- The chooser locks background scrolling, focuses Change picture, and fits 320px, 390px, and desktop viewports.

## Checks

- `npm.cmd run test`: 88 tests passed across 10 files.
- `npm.cmd run lint`: passed. A final focused lint run also passed after the chooser focus adjustment.
- `npm.cmd run build`: final build passed.
- `npm.cmd exec playwright -- test --config playwright.object-editing.config.ts`: 14 checks passed; one old letter test expected an unselected envelope to move.
- Updated that letter test to select the envelope before dragging. Its isolated rerun passed, completing all 15 relevant browser checks. An earlier isolated attempt timed out while Vite was loading the viewer; the final rerun passed in 22.5 seconds.
- Browser checks cover object addition, mouse/touch dragging, placement, transforms, geometry reuse, keyboard controls, history, drafts, all four frame designs, cropping, sharing, recipient viewing, remixing, and PNG downloads.

## Visual evidence

- `grid-before-objects.png`: ground grid before adding an object.
- `stem-ground.png`: teddy and exposed stems aligned to the common floor.
- `stem-ground-card.png`: PNG card without the editing grid.
- `gift-without-grid.png`: gift scene without the editing grid.
- `frame-dialog-1280.png`, `frame-dialog-390.png`, `frame-dialog-320.png`: frame chooser at desktop and narrow widths.

The mobile UI changes being developed in the other chat were retained in the shared working directory. This change primarily touches the object scene, Viewer, ObjectsPanel, and frame dialog styles; App edits are limited to the scene hint and ignoring design shortcuts inside dialogs.
