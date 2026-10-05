# PetalPop - overlay ad V2

The replacement follows the supplied CapCut blueprint's central production idea: finish a clear cut, draw a specific graphic for each useful moment, render graphics with transparency, and place graphics and sound on separate tracks. The first export is preserved in `archive/petalpop-v1.mp4` and in the original `project-demo/output/` folder.

## Watch

Open `index.html` through the local preview server, or play `petalpop-overlay-ad.mp4` directly. The master is 90 seconds, 1080 x 1920, 30 fps, with burned-in captions and an original 132 BPM score. The app's actual flower, arrangement, letter, photo, confetti and sharing interactions supply the footage.

## Edit in CapCut

The complete portable handoff is `../delivery/PetalPop-Ad-V2.zip`. It includes the final video, captions, revised script, all footage/overlay/audio assets and the draft. Extract it, copy its CapCut project folder to the desired Drafts location, and use the included `Relink-Media.ps1` with that project folder as `-ProjectPath`. The relinker checks media hashes, keeps a draft backup, and changes only media locations. A moved copy was checked: all 64 material references resolved and the timeline stayed unchanged.

The generated draft is in `capcut-projects/PetalPop - Overlay Ad V2/`. It has these tracks:

| Track | Contents |
| --- | --- |
| PP-BASE | 15 individually cut, reframed app clips |
| PP-OVERLAYS | 15 transparent ProRes 4444 MOVs, named PP-01 through PP-15 |
| PP-NARRATION | The existing local synthetic narration |
| PP-MUSIC | The new original score, already ducked under speech |
| PP-SFX-IN | Individual arrival cues |
| PP-SFX-OUT | Individual departure cues |
| PP-TAP-SFX | Two quantity-tap cues |

In CapCut desktop, locate **Settings > Drafts location**. Copy the generated project folder into that location and refresh the project list. The original workspace draft references local workspace media; the portable ZIP includes its own Media folder. The draft's JSON, timing, dimensions and media references are checked locally. CapCut 9.4.0.4015 was installed from the official Windows package; the desktop automation app-access request timed out, so opening and rendering the draft inside CapCut remain unverified. It was generated with [pyCapCut](https://github.com/GuanYixuan/pyCapCut), whose draft support is experimental. No live CapCut project was changed.

To redraw a particular moment, use its PP identifier and the description in `candidate-moments.json`. The editable drawing source is `../src/OverlayAd.tsx`. Rebuilds replace the tool's overlay and audio tracks and preserve the existing base and unrelated tracks. Manual changes on the tool's tracks are replaced during a rebuild. A changed main cut invalidates the placement guard and requires re-opening the cut first.

## How this adapts the blueprint

No existing CapCut project was found in the usual local folders, so this is a new local project built from the existing feature script and original app captures. The revised production script is `../../docs/marketing-overlay-script.md`. Its 90-second frame axis is the timing authority. Existing timed narration and captions are reused; no second transcription was performed.

The numbered feature list supplied the moments. This run used one editorial review, followed by frame inspection and local repairs. It did **not** perform the blueprint's two independent agent discovery passes or record a new keep/drop approval as if the user had provided one. This package is a production adaptation for this ad, not the original author's unreleased skill or a complete general-purpose implementation of every stage in the PDF.

Graphics are authored separately as React/SVG animation. Each has its own brief and source-frame references. The family is checked for resolution, duration and alpha before the final composition; the base clips are fingerprinted to detect changed timing or media. The letter cut removes a 0.7-second empty interval between the paper exit and the editor while retaining the native reveal and editing. The occasion montage uses the actual birthday, anniversary and thank-you captures.

The final MP4 and editable draft use the same music, narration and sound assets with a shared measured gain. Sound cues vary by motion: slide, ribbon, greenery, airy adjustment, bounce, paper, camera, confetti and chime. The synthetic score uses electric-piano-style chords, a syncopated bass, bright plucks, stereo percussion, a quieter letter/photo section and a final cadence; it uses no sampled songs.

## Rebuild commands

Run from the repository root. Dependencies are in `project-demo/node_modules` and the local `.cache/capcut-python` folder.

```powershell
node project-demo/scripts/overlay-prep.mjs
node project-demo/scripts/overlay-base.mjs
node project-demo/scripts/overlay-audio.mjs
node project-demo/scripts/overlay-render.mjs
node project-demo/scripts/overlay-assemble.mjs
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' project-demo/scripts/overlay-capcut.py
node project-demo/scripts/overlay-qa.mjs
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' project-demo/scripts/overlay-package.py
```

After the first complete export, the base is frozen. `overlay-base.mjs` refuses a casual rebuild unless `--reopen-cut` is supplied deliberately; redraw and reassemble the complete graphic family after changing the cut. A targeted redraw accepts `--ids=07,10` and stages a complete replacement overlay family before committing it. CapCut writes are limited to this workspace draft.

`qa-report.json` records the completed output checks. `alpha-verification.json` records actual transparent pixel checks, beyond checking the codec. `capcut-draft-report.json` records structural validation. `capcut-ui-validation.json` records the relocation check and desktop access timeout. `../delivery/package-report.json` records the archive CRC and per-file SHA256 checks. `moment-sheet.csv` provides the numbered timed graphics list.

Reference: Ben Lim / BITSTAQ, *The CapCut Auto-Overlay Blueprint*, version 1, 19 August 2026, supplied as `C:\Users\user\Downloads\capcut-auto-overlay-blueprint.pdf`. Its contact details are source attribution; no contact message was sent.
