# GroovyDrummer

GroovyDrummer is a static Tone.js browser app for previewing the JJ Groove Pack MIDI files in this repository without opening a DAW.

## Features

- Pack, tempo, and part segmentation for Dreaming In Theaters, Lakeside Camping, Lamb Chops, and the filtered Punk Archive subset.
- Home Kit acoustic drum preview using a curated browser subset from `Strike Sound - Home Kit - WAV`, with a synthetic fallback kit.
- General MIDI and common drum-map preview using the mapping from the included manuals plus alternate kick, snare, hat, tom, ride, and crash articulations.
- Single-groove MIDI downloads.
- Single-groove rendered mix WAV and stems ZIP exports.
- Selected-groove export as MIDI ZIP, mix WAV ZIP, or stems ZIP.

## Home Kit samples

The full `Strike Sound - Home Kit - WAV` source folder is intentionally not required by GitHub Pages. The app ships a curated balanced subset under `public/samples/home-kit-balanced/`.

To regenerate that subset from the local source folder:

```bash
npm run prepare:home-kit
```

To verify the committed browser-ready samples:

```bash
npm run verify-home-kit
```

## Development

```bash
npm install
npm run dev
```

The catalog is generated from the `* (JJ Groove Packs)` folders before the dev server starts, and the Home Kit subset is verified.

## Build

```bash
npm run build
```

Generated browser assets are written to `dist/`. Generated catalog and copied MIDI files under `public/` are intentionally ignored because the build regenerates them.
