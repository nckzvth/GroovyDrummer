import { Midi } from "@tonejs/midi";
import { drumGroupForNote } from "./drumMap";
import type { DrumGroup, Groove, PatternMap } from "./types";

export type BuilderCellValue = 0 | 1 | 2 | 3;

export type BuilderLane = {
  id: string;
  label: string;
  note: number;
  velocity: number;
  accentVelocity: number;
  cells: BuilderCellValue[];
};

export type BuilderState = {
  title: string;
  tempo: number;
  bars: number;
  lanes: BuilderLane[];
  revision: number;
};

export const builderPackId = "part-builder";

export const builderNoteOptions: Array<{ label: string; note: number }> = [
  { label: "Kick", note: 36 },
  { label: "Snare", note: 38 },
  { label: "Snare Rim", note: 39 },
  { label: "Side Stick", note: 37 },
  { label: "Closed Hat", note: 42 },
  { label: "Pedal Hat", note: 44 },
  { label: "Open Hat", note: 46 },
  { label: "Ride Bow", note: 51 },
  { label: "Crash Ride", note: 59 },
  { label: "Ride Bell", note: 53 },
  { label: "Crash L", note: 49 },
  { label: "Crash R", note: 57 },
  { label: "Rack Tom", note: 48 },
  { label: "Floor Tom", note: 43 },
];

const stepsPerBar = 16;
const patternGroups: DrumGroup[] = ["kick", "snare", "hat", "tom", "ride", "crash"];

export function createInitialBuilderState(): BuilderState {
  const cells = (hits: Array<[number, BuilderCellValue]>) => {
    const values = Array<BuilderCellValue>(stepsPerBar * 2).fill(0);
    for (const [index, value] of hits) {
      values[index] = value;
    }
    return values;
  };

  return {
    title: "Custom Part",
    tempo: 180,
    bars: 2,
    revision: 0,
    lanes: [
      makeLane("kick", "Kick", 36, cells([[0, 3], [2, 2], [8, 3], [10, 2], [16, 3], [18, 2], [24, 3], [30, 2]]), 0.9, 1),
      makeLane("snare", "Snare", 38, cells([[4, 3], [12, 3], [20, 3], [28, 3]]), 0.88, 0.98),
      makeLane("open-hat", "Open Hat", 46, cells([[0, 2], [4, 2], [8, 2], [12, 2], [16, 2], [20, 2], [24, 2], [28, 2]]), 0.74, 0.88),
      makeLane("crash-ride", "Crash Ride", 59, cells([[0, 3], [16, 2]]), 0.74, 0.9),
      makeLane("rack-tom", "Rack Tom", 48, cells([]), 0.78, 0.92),
      makeLane("floor-tom", "Floor Tom", 43, cells([[29, 2], [30, 2], [31, 3]]), 0.78, 0.92),
    ],
  };
}

export function resizeBuilderCells(builder: BuilderState, bars: number) {
  const nextLength = bars * stepsPerBar;
  builder.bars = bars;
  for (const lane of builder.lanes) {
    if (lane.cells.length < nextLength) {
      lane.cells = [...lane.cells, ...Array<BuilderCellValue>(nextLength - lane.cells.length).fill(0)];
    } else {
      lane.cells = lane.cells.slice(0, nextLength);
    }
  }
  builder.revision += 1;
}

export function builderStepCount(builder: BuilderState) {
  return builder.bars * stepsPerBar;
}

export function buildCustomGroove(builder: BuilderState): Groove {
  const tempo = Math.max(1, builder.tempo);
  const title = builder.title.trim() || "Custom Part";
  const midi = new Midi();
  midi.header.setTempo(tempo);

  const track = midi.addTrack();
  track.channel = 9;
  track.name = title;

  for (const lane of builder.lanes) {
    for (let step = 0; step < builderStepCount(builder); step += 1) {
      const value = lane.cells[step] ?? 0;
      if (!value) {
        continue;
      }

      const beat = step / 4;
      track.addNote({
        midi: lane.note,
        time: beatToSeconds(beat, tempo),
        duration: beatToSeconds(noteDurationBeats(lane.note), tempo),
        velocity: velocityForCell(lane, value),
      });
    }
  }

  const midiData = midi.toArray();
  const notes = midi.tracks.flatMap((midiTrack) => midiTrack.notes);
  const duration = builder.bars * 4 * 60 / tempo;
  const hitCounts = summarizeHits(notes);
  const usedNotes = [...new Set(notes.map((note) => note.midi))].sort((a, b) => a - b);

  return {
    id: `${builderPackId}/custom/${builder.revision}`,
    packId: builderPackId,
    packName: "Part Builder",
    midiMap: "gm",
    tempoId: `${formatTempo(tempo)}-bpm`,
    tempoLabel: `${formatTempo(tempo)} BPM`,
    tempoRange: [tempo, tempo],
    tempoSort: tempo,
    bpm: tempo,
    categoryId: "custom",
    categoryName: "Custom Parts",
    categorySort: 1,
    grooveName: title,
    grooveNumber: 1,
    meter: "4/4",
    sourcePath: "Part Builder",
    assetPath: `${builderPackId}/${builder.revision}.mid`,
    size: midiData.byteLength,
    duration: Number(duration.toFixed(3)),
    noteCount: notes.length,
    hitCounts,
    usedNotes,
    pattern: makePattern(notes, duration),
    midiData,
  };
}

function makeLane(
  id: string,
  label: string,
  note: number,
  cells: BuilderCellValue[],
  velocity: number,
  accentVelocity: number,
): BuilderLane {
  return { id, label, note, cells, velocity, accentVelocity };
}

function beatToSeconds(beat: number, tempo: number) {
  return beat * 60 / tempo;
}

function velocityForCell(lane: BuilderLane, value: BuilderCellValue) {
  if (value === 1) {
    return Math.max(0.02, Math.min(1, lane.velocity * 0.58));
  }
  if (value === 3) {
    return Math.max(0.02, Math.min(1, lane.accentVelocity));
  }
  return Math.max(0.02, Math.min(1, lane.velocity));
}

function noteDurationBeats(note: number) {
  if ([46, 49, 57, 59].includes(note)) {
    return 0.5;
  }
  if ([51, 53].includes(note)) {
    return 0.3;
  }
  if ([42, 44].includes(note)) {
    return 0.08;
  }
  return 0.14;
}

function summarizeHits(notes: Array<{ midi: number }>) {
  const counts = Object.fromEntries(patternGroups.map((group) => [group, 0])) as Record<DrumGroup, number>;
  for (const note of notes) {
    const group = drumGroupForNote(note.midi, "gm");
    if (group) {
      counts[group] += 1;
    }
  }
  return counts;
}

function makePattern(notes: Array<{ midi: number; time: number; velocity: number }>, duration: number): PatternMap {
  const bins = 32;
  const lanes: PatternMap = {
    kick: Array(bins).fill(0),
    snare: Array(bins).fill(0),
    hat: Array(bins).fill(0),
    tom: Array(bins).fill(0),
    ride: Array(bins).fill(0),
    crash: Array(bins).fill(0),
  };
  const safeDuration = Math.max(duration, 0.25);

  for (const note of notes) {
    const group = drumGroupForNote(note.midi, "gm");
    if (!group) {
      continue;
    }
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((note.time / safeDuration) * bins)));
    lanes[group][bin] = Math.min(1, Math.max(lanes[group][bin], note.velocity || 0.65));
  }

  return lanes;
}

function formatTempo(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
