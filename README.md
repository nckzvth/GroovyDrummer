# GroovyDrummer

GroovyDrummer is a static Tone.js browser app for previewing the JJ Groove Pack MIDI files in this repository without opening a DAW.

## Features

- Pack, tempo, and part segmentation for Dreaming In Theaters, Lakeside Camping, and Lamb Chops.
- General MIDI drum preview using the mapping from the included manuals.
- Single-groove MIDI downloads.
- Selected-groove export as either a local `output/` folder structure or a ZIP with the same layout.

## Development

```bash
npm install
npm run dev
```

The catalog is generated from the `* (JJ Groove Packs)` folders before the dev server starts.

## Build

```bash
npm run build
```

Generated browser assets are written to `dist/`. Generated catalog and copied MIDI files under `public/` are intentionally ignored because the build regenerates them.

## Sample Credits

The sampled preview kit uses `@teropa/drumkit`. Its code is MIT licensed, and its samples are credited in that package to DWSD's Deep House Drum kit on freesound.org under Creative Commons Attribution, plus cymbal and tom samples from Stomachache and Karman Lyne under Creative Commons 0.
