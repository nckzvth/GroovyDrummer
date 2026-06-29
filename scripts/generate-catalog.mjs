import midiPackage from "@tonejs/midi";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");
const midiOutDir = path.join(publicDir, "midi");
const catalogPath = path.join(publicDir, "catalog.json");
const { Midi } = midiPackage;

const gmMap = [
  { note: 36, noteName: "C1", name: "Kick Hit", group: "kick" },
  { note: 38, noteName: "D1", name: "Snare Hit", group: "snare" },
  { note: 50, noteName: "D2", name: "Rack Tom 1 Hit", group: "tom" },
  { note: 43, noteName: "G1", name: "Rack Tom 2 Hit", group: "tom" },
  { note: 48, noteName: "C2", name: "Floor Tom 1 Hit", group: "tom" },
  { note: 41, noteName: "F1", name: "Floor Tom 2 Hit", group: "tom" },
  { note: 42, noteName: "F#1", name: "Hi-Hat Tip Tight", group: "hat" },
  { note: 54, noteName: "F#2", name: "Hi-Hat Tip Closed", group: "hat" },
  { note: 46, noteName: "A#1", name: "Hi-Hat Open 2", group: "hat" },
  { note: 58, noteName: "A#2", name: "Hi-Hat Open 3", group: "hat" },
  { note: 44, noteName: "G#1", name: "Hi-Hat Pedal", group: "hat" },
  { note: 53, noteName: "F2", name: "Ride Bell", group: "ride" },
  { note: 51, noteName: "D#2", name: "Ride Cymbal", group: "ride" },
  { note: 49, noteName: "C#2", name: "Main Crash Left Hit", group: "crash" },
  { note: 57, noteName: "A2", name: "Main Crash Right Hit", group: "crash" },
  { note: 52, noteName: "E2", name: "China Hit", group: "crash" },
  { note: 55, noteName: "G2", name: "Splash Hit", group: "crash" },
];

const gmGroups = new Map(gmMap.map((hit) => [hit.note, hit.group]));
const patternGroups = ["kick", "snare", "hat", "tom", "ride", "crash"];

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanFolderName(value) {
  return value.replace(/^\d+\s*-\s*/, "").trim();
}

function parseTempo(folderName) {
  const label = cleanFolderName(folderName);
  const match = label.match(/(\d+)\s*-\s*(\d+)\s*BPM/i);
  const low = match ? Number(match[1]) : null;
  const high = match ? Number(match[2]) : null;
  return {
    id: slug(label),
    label,
    range: low && high ? [low, high] : null,
    bpm: low && high ? Math.round((low + high) / 2) : null,
    sort: low ?? 0,
  };
}

async function listMidiFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMidiFiles(fullPath)));
    } else if (/\.(mid|midi)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function makePattern(notes, duration) {
  const bins = 32;
  const lanes = Object.fromEntries(patternGroups.map((group) => [group, Array(bins).fill(0)]));
  const safeDuration = Math.max(duration, 0.25);

  for (const note of notes) {
    const group = gmGroups.get(note.midi) ?? "tom";
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((note.time / safeDuration) * bins)));
    lanes[group][bin] = Math.min(1, Math.max(lanes[group][bin], note.velocity || 0.65));
  }

  return lanes;
}

function summarizeHits(notes) {
  const counts = Object.fromEntries(patternGroups.map((group) => [group, 0]));
  const usedNotes = new Set();

  for (const note of notes) {
    const group = gmGroups.get(note.midi) ?? "tom";
    counts[group] += 1;
    usedNotes.add(note.midi);
  }

  return {
    counts,
    notes: [...usedNotes].sort((a, b) => a - b),
  };
}

async function main() {
  const rootEntries = await readdir(rootDir, { withFileTypes: true });
  const packDirs = rootEntries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("(JJ Groove Packs)"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (!packDirs.length) {
    throw new Error("No JJ Groove Pack directories found.");
  }

  await rm(midiOutDir, { recursive: true, force: true });
  await mkdir(midiOutDir, { recursive: true });

  const grooves = [];

  for (const packDirName of packDirs) {
    const packName = packDirName.replace(/\s*\(JJ Groove Packs\)$/, "");
    const packId = slug(packName);
    const packDir = path.join(rootDir, packDirName);
    const midiFiles = await listMidiFiles(packDir);

    for (const midiPath of midiFiles) {
      const relativeSourcePath = path.relative(rootDir, midiPath);
      const relativeParts = path.relative(packDir, midiPath).split(path.sep);

      if (relativeParts.length < 3) {
        continue;
      }

      const [tempoFolder, categoryFolder, fileName] = relativeParts;
      const tempo = parseTempo(tempoFolder);
      const categoryName = cleanFolderName(categoryFolder);
      const categorySort = Number(categoryFolder.match(/^(\d+)/)?.[1] ?? 0);
      const categoryId = slug(categoryName);
      const grooveName = path.basename(fileName, path.extname(fileName));
      const grooveNumber = Number(grooveName.match(/Groove\s*(\d+)/i)?.[1] ?? grooveName.match(/(\d+)/)?.[1] ?? 0);
      const meterMatch = grooveName.match(/^(\d+)-(\d+)\s*-/);
      const destinationPath = path.join(midiOutDir, packId, tempo.id, categoryId, `${slug(grooveName)}.mid`);
      const assetPath = path.relative(publicDir, destinationPath).split(path.sep).join("/");

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(midiPath, destinationPath);

      const [bytes, buffer] = await Promise.all([stat(midiPath), readFile(midiPath)]);
      const midi = new Midi(buffer);
      const notes = midi.tracks.flatMap((track) => track.notes);
      const duration = midi.duration || notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
      const hits = summarizeHits(notes);

      grooves.push({
        id: `${packId}/${tempo.id}/${categoryId}/${slug(grooveName)}`,
        packId,
        packName,
        tempoId: tempo.id,
        tempoLabel: tempo.label,
        tempoRange: tempo.range,
        tempoSort: tempo.sort,
        bpm: tempo.bpm,
        categoryId,
        categoryName,
        categorySort,
        grooveName,
        grooveNumber,
        meter: meterMatch ? `${meterMatch[1]}/${meterMatch[2]}` : null,
        sourcePath: relativeSourcePath.split(path.sep).join("/"),
        assetPath,
        size: bytes.size,
        duration: Number(duration.toFixed(3)),
        noteCount: notes.length,
        hitCounts: hits.counts,
        usedNotes: hits.notes,
        pattern: makePattern(notes, duration),
      });
    }
  }

  grooves.sort((a, b) =>
    a.packName.localeCompare(b.packName) ||
    (b.tempoRange?.[0] ?? 0) - (a.tempoRange?.[0] ?? 0) ||
    a.categorySort - b.categorySort ||
    a.grooveNumber - b.grooveNumber ||
    a.grooveName.localeCompare(b.grooveName),
  );

  const packs = packDirs.map((packDirName) => {
    const packName = packDirName.replace(/\s*\(JJ Groove Packs\)$/, "");
    const packId = slug(packName);
    const packGrooves = grooves.filter((groove) => groove.packId === packId);
    const tempos = [...new Map(packGrooves.map((groove) => [groove.tempoId, {
      id: groove.tempoId,
      label: groove.tempoLabel,
      range: groove.tempoRange,
      bpm: groove.bpm,
      count: packGrooves.filter((item) => item.tempoId === groove.tempoId).length,
    }])).values()].sort((a, b) => (b.range?.[0] ?? 0) - (a.range?.[0] ?? 0));
    const categories = [...new Map(packGrooves.map((groove) => [groove.categoryId, {
      id: groove.categoryId,
      name: groove.categoryName,
      sort: groove.categorySort,
      count: packGrooves.filter((item) => item.categoryId === groove.categoryId).length,
    }])).values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

    return {
      id: packId,
      name: packName,
      count: packGrooves.length,
      tempos,
      categories,
    };
  });

  await writeFile(catalogPath, `${JSON.stringify({
    appName: "GroovyDrummer",
    generatedAt: new Date().toISOString(),
    totalGrooves: grooves.length,
    gmMap,
    packs,
    grooves,
  }, null, 2)}\n`);

  console.log(`Generated ${grooves.length} grooves in ${path.relative(rootDir, catalogPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
