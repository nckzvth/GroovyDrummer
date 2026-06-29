import midiPackage from "@tonejs/midi";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Midi } = midiPackage;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(path.join(rootDir, "public", "catalog.json"), "utf8"));
const grooves = catalog.grooves.filter((groove) => groove.packId === "groovy-drummer");
const expectedCategories = new Map([
  ["Main Grooves", 12],
  ["Backbeats", 6],
  ["Blast Beats", 6],
  ["Fills", 12],
  ["Intros / Stops", 6],
]);

if (grooves.length !== 42) {
  throw new Error(`Expected 42 GroovyDrummer grooves, found ${grooves.length}.`);
}

if (grooves.some((groove) => /skank collapse/i.test(groove.grooveName))) {
  throw new Error("Removed name Skank Collapse is still present.");
}

for (const [categoryName, count] of expectedCategories) {
  const actual = grooves.filter((groove) => groove.categoryName === categoryName).length;
  if (actual !== count) {
    throw new Error(`Expected ${count} ${categoryName} grooves, found ${actual}.`);
  }
}

const signatures = new Map();
const failures = [];

for (const groove of grooves) {
  const midiPath = path.join(rootDir, "public", groove.assetPath);
  const midi = new Midi(await readFile(midiPath));
  const bpm = midi.header.tempos[0]?.bpm ?? groove.bpm ?? 120;
  const beats = midi.tracks
    .flatMap((track) => track.notes.map((note) => ({
      midi: note.midi,
      beat: roundBeat(note.time * bpm / 60),
      velocity: note.velocity,
    })))
    .sort((a, b) => a.beat - b.beat || a.midi - b.midi);

  if (["Main Grooves", "Backbeats"].includes(groove.categoryName)) {
    const badKick = beats.find((event) => event.midi === 36 && !onGrid(event.beat, 0.5));
    if (badKick) {
      failures.push(`${groove.grooveName} has off-grid kick at beat ${badKick.beat}.`);
    }
  }

  if (groove.categoryName === "Main Grooves") {
    for (const barStart of [0, 4]) {
      for (const snareBeat of [barStart + 1, barStart + 3]) {
        if (!beats.some((event) => [38, 40].includes(event.midi) && near(event.beat, snareBeat))) {
          failures.push(`${groove.grooveName} is missing snare anchor at beat ${snareBeat}.`);
        }
      }
    }
  }

  if (["Backbeats", "Blast Beats", "Fills", "Intros / Stops"].includes(groove.categoryName)) {
    const signature = patternSignature(beats);
    const previous = signatures.get(`${groove.categoryName}:${signature}`);
    if (previous) {
      failures.push(`${groove.categoryName} duplicate pattern: ${previous} and ${groove.grooveName}.`);
    } else {
      signatures.set(`${groove.categoryName}:${signature}`, groove.grooveName);
    }
  }
}

if (failures.length) {
  throw new Error(failures.join("\n"));
}

console.log(`Validated ${grooves.length} GroovyDrummer grooves with unique generated part grids.`);

function patternSignature(events) {
  return events
    .map((event) => `${event.midi}@${event.beat}`)
    .join("|");
}

function roundBeat(value) {
  return Math.round(value * 1000) / 1000;
}

function near(value, target) {
  return Math.abs(value - target) < 0.001;
}

function onGrid(value, step) {
  return near(value / step, Math.round(value / step));
}
