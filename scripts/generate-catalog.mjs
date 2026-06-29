import midiPackage from "@tonejs/midi";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");
const midiOutDir = path.join(publicDir, "midi");
const catalogPath = path.join(publicDir, "catalog.json");
const archiveDirName = "800000_Drum_Percussion_MIDI_Archive[6_19_15]";
const execFileAsync = promisify(execFile);
const { Midi } = midiPackage;
const gmMap = JSON.parse(await readFile(path.join(rootDir, "src", "drum-map.json"), "utf8"));

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

function tempoFromBpm(bpm) {
  return {
    id: bpm ? `${bpm}-bpm` : "unknown-bpm",
    label: bpm ? `${bpm} BPM` : "Unknown BPM",
    range: bpm ? [bpm, bpm] : null,
    bpm,
    sort: bpm ?? 0,
  };
}

function parseArchiveTempo(parts, fileName) {
  const text = [...parts, fileName].join(" ");
  const bpmMatch = [...text.matchAll(/(?:^|[^0-9])(\d{2,3})\s*bpm\b/gi)]
    .map((match) => Number(match[1]))
    .find((value) => value >= 40 && value <= 320);

  if (bpmMatch) {
    return tempoFromBpm(bpmMatch);
  }

  const baseName = path.basename(fileName, path.extname(fileName));
  const leadingTempo = Number(baseName.match(/^(\d{2,3})(?=\D)/)?.[1] ?? 0);
  return tempoFromBpm(leadingTempo >= 40 && leadingTempo <= 320 ? leadingTempo : null);
}

function prettyArchiveSegment(value) {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\.(sng|prt|lib)$/i, "")
    .replace(/^\d+@/, "")
    .replace(/^\d+\s*-\s*/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTempo(value) {
  const pretty = prettyArchiveSegment(value);
  return pretty.replace(/\b\d{2,3}\s*bpm\b/gi, "").replace(/\s+/g, " ").trim() || pretty;
}

const archiveCategoryOrder = new Map([
  ["Backbeats", 1],
  ["Grooves", 2],
  ["Fills", 3],
  ["Intros / Endings", 4],
]);

function archiveCategorySort(categoryName) {
  return archiveCategoryOrder.get(categoryName) ?? 99;
}

function archivePartCategory(parts, fileName) {
  const text = [...parts.map(stripTempo), prettyArchiveSegment(fileName)]
    .join(" ")
    .toLowerCase();

  if (/\bback\s*beat\b/.test(text) || /\bbackbeat\b/.test(text)) {
    return "Backbeats";
  }
  if (/\bfill(?:s)?\b/.test(text) && !/\bno\s+fill\b/.test(text)) {
    return "Fills";
  }
  if (/\bintro\b|\boutro\b|\bend(?:ing)?\b|\bcount(?:s)?\b|\bhit(?:s)?\b/.test(text)) {
    return "Intros / Endings";
  }
  if (/\bgroove(?:s)?\b|\bsong\s*loop(?:s)?\b|\bsingle\s*track\b|\bmulti[-\s]*track\b|\btype\s*0\b|\bpunk\s*rock\b|\bstraight\b|\bclassic\s*beats\b|\bbonus\b|\bpreview\s*file(?:s)?\b/.test(text)) {
    return "Grooves";
  }
  return "Grooves";
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseMeter(value) {
  const match = value.match(/(?:^|\D)(\d+)[-_](\d+)(?:\D|$)/);
  return match ? `${match[1]}/${match[2]}` : null;
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

async function listArchivePunkMidiFiles(archiveDir) {
  const { stdout } = await execFileAsync("find", [
    archiveDir,
    "-type",
    "f",
    "(",
    "-iname",
    "*.mid",
    "-o",
    "-iname",
    "*.midi",
    ")",
    "-ipath",
    "*punk*",
  ], { maxBuffer: 64 * 1024 * 1024 });

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function makePattern(notes, duration) {
  const bins = 32;
  const lanes = Object.fromEntries(patternGroups.map((group) => [group, Array(bins).fill(0)]));
  const safeDuration = Math.max(duration, 0.25);

  for (const note of notes) {
    const group = gmGroups.get(note.midi);
    if (!group) {
      continue;
    }
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((note.time / safeDuration) * bins)));
    lanes[group][bin] = Math.min(1, Math.max(lanes[group][bin], note.velocity || 0.65));
  }

  return lanes;
}

function summarizeHits(notes) {
  const counts = Object.fromEntries(patternGroups.map((group) => [group, 0]));
  const usedNotes = new Set();

  for (const note of notes) {
    const group = gmGroups.get(note.midi);
    if (!group) {
      continue;
    }
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
  const packNames = new Map();

  for (const packDirName of packDirs) {
    const packName = packDirName.replace(/\s*\(JJ Groove Packs\)$/, "");
    const packId = slug(packName);
    packNames.set(packId, packName);
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

  const archiveDir = path.join(rootDir, archiveDirName);
  try {
    await stat(archiveDir);
    const packId = "punk-archive";
    const packName = "Punk Archive";
    const midiFiles = await listArchivePunkMidiFiles(archiveDir);
    packNames.set(packId, packName);

    for (const midiPath of midiFiles) {
      const relativeSourcePath = path.relative(rootDir, midiPath);
      const relativeParts = path.relative(archiveDir, midiPath).split(path.sep);
      const fileName = relativeParts.at(-1);
      const dirParts = relativeParts.slice(0, -1);

      if (!fileName || !dirParts.length) {
        continue;
      }

      const tempo = parseArchiveTempo(dirParts, fileName);
      const categoryName = archivePartCategory(dirParts, fileName);
      const categorySort = 1000 + archiveCategorySort(categoryName);
      const categoryId = slug(categoryName);
      const grooveName = prettyArchiveSegment(path.basename(fileName, path.extname(fileName)));
      const grooveNumber = Number(grooveName.match(/^(\d+)/)?.[1] ?? grooveName.match(/(\d+)/)?.[1] ?? 0);
      const sourceHash = stableHash(relativeSourcePath);
      const destinationPath = path.join(
        midiOutDir,
        packId,
        categoryId,
        tempo.id,
        `${slug(grooveName)}-${sourceHash}.mid`,
      );
      const assetPath = path.relative(publicDir, destinationPath).split(path.sep).join("/");

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(midiPath, destinationPath);

      const [bytes, buffer] = await Promise.all([stat(midiPath), readFile(midiPath)]);
      const midi = new Midi(buffer);
      const notes = midi.tracks.flatMap((track) => track.notes);
      const duration = midi.duration || notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
      const hits = summarizeHits(notes);

      grooves.push({
        id: `${packId}/${categoryId}/${tempo.id}/${slug(grooveName)}-${sourceHash}`,
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
        meter: parseMeter(`${dirParts.join(" ")} ${grooveName}`),
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
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  grooves.sort((a, b) =>
    a.packName.localeCompare(b.packName) ||
    (b.tempoRange?.[0] ?? 0) - (a.tempoRange?.[0] ?? 0) ||
    a.categorySort - b.categorySort ||
    a.grooveNumber - b.grooveNumber ||
    a.grooveName.localeCompare(b.grooveName),
  );

  const packs = [...packNames.entries()].map(([packId, packName]) => {
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
