# PetalPop 3D — Little blooms. Big feelings.

This isolated production package turns `../docs/marketing-ad-script.md` into a 90-second, 1080 × 1920, 30 fps marketing ad. It uses actual local app interactions, a Remotion composition with per-scene motion design, original 120 BPM synthesized electropop and sound effects, local Kokoro narration, and subtitles.

## Rebuild

Start the app from the repository root on port 5206:

```powershell
npm.cmd run dev -- --port 5206 --strictPort
```

From `project-demo`:

```powershell
npm.cmd install --ignore-scripts --no-audit --no-fund
npm.cmd run capture
npm.cmd run audio
node scripts/refine-media.mjs
npm.cmd run render
node scripts/finalize.mjs
npm.cmd run qa
npm.cmd run preview-check
```

`capture` reuses completed shots and saved fictional checkpoints; pass `--force` to re-record. The browser, FFmpeg, and previous local voice-model installation are explicitly resolved in `scripts/common.mjs`. This production reuses the verified DevDock tool installation on this machine. For a different machine, install matching tools and update those paths. Nothing is committed or published by these scripts.

## Outputs

- `output/petalpop-marketing-ad.mp4`: final vertical video, narration/music/SFX, burned-in subtitles.
- `output/petalpop-marketing-ad.srt`: external subtitles.
- `output/petalpop-poster.png`: video poster.
- `output/index.html`: video player with feature chapter controls.
- `output/qa/contact-sheet.jpg`: representative frames.
- Recording, audio, rendering, and QA reports in `output/`.
- `public/assets/original-score.wav`: original music alone.
- `public/assets/soundtrack.wav`: narration, music, and sound design mix.

The app's normal browser profile is not used. Captures use isolated contexts and fictional names. Sharing is demonstrated on localhost; the ad does not display a fabricated public destination or automatic email delivery. Existing app source edits remain outside this video package.

Recording uses a tiny synchronization marker outside the displayed crops. FFmpeg decodes and trims the recorded frames directly. `scripts/sync-media.mjs` can recover boundaries from existing recordings. In the software-rendered capture, native CSS motion can stretch; `refine-media` retains the complete envelope flight and note appearance and restores their designed duration to a 2.2-second edit. It also holds the actual copied-link result for one second. The reports record these adjustments.

## Image provenance

`public/assets/memory-photo.png` was created with the built-in **imagegen** tool for this demo, then copied into the workspace. It depicts fictional adults and is not a personal customer photograph.

Prompt: “Create one natural photorealistic keepsake snapshot for a fictional digital birthday-gift demo. Two fictional young adults in their mid-20s, one woman and one man, laughing together on a sunny seaside boardwalk at golden hour. Warm affectionate friendship/relationship, candid joyful expressions, tasteful casual cream and soft pastel clothes, gentle ocean and sky behind them. Vertical portrait composition, both faces clearly visible near the upper-middle so the photo also crops gracefully to a 5:4 landscape frame, shoulders and scenic background around them. Soft film-like photographic texture, natural lighting and skin, realistic features, warm cream, blush and sage tones matching a friendly pastel flower-gifting app. No words, no watermark, no brands, no picture frame, no UI, no flowers overlay. This is a standalone fictional memory photo, not a photograph of any known person.”

Flower and companion thumbnails come from the project's original asset catalog. Decorative petals, linework, transition graphics, and typography are rendered directly in the composition. The score uses synthesized instruments and original note patterns; it contains no stock song or sampled recordings. Narration uses a generic synthetic voice, `af_heart`, through the existing locally installed Kokoro engine.
