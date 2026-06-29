# GroovyDrummer

GroovyDrummer is a static Tone.js browser app for previewing the JJ Groove Pack MIDI files in this repository without opening a DAW.

## Features

- Pack, tempo, and part segmentation for Dreaming In Theaters, Lakeside Camping, Lamb Chops, and the filtered Punk Archive subset.
- General MIDI and common drum-map preview using the mapping from the included manuals plus alternate kick, snare, hat, tom, ride, and crash articulations.
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
