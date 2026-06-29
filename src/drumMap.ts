import drumMapData from "./drum-map.json";
import type { DrumGroup, DrumMapHit, MidiMapMode } from "./types";

export const drumMap: DrumMapHit[] = drumMapData.map((hit) => ({
  ...hit,
  group: hit.group as DrumGroup,
}));

const groupByNote = new Map<number, DrumGroup>(drumMap.map((hit) => [hit.note, hit.group]));
const addictiveDrumsGroupByNote = new Map<number, DrumGroup>([
  [36, "kick"],

  [35, "snare"],
  [37, "snare"],
  [38, "snare"],
  [39, "snare"],
  [40, "snare"],
  [41, "snare"],
  [42, "snare"],
  [43, "snare"],
  [44, "snare"],

  [48, "hat"],
  [49, "hat"],
  [50, "hat"],
  [51, "hat"],
  [52, "hat"],
  [53, "hat"],
  [54, "hat"],
  [55, "hat"],
  [56, "hat"],
  [57, "hat"],
  [58, "hat"],
  [59, "hat"],

  [65, "tom"],
  [66, "tom"],
  [67, "tom"],
  [68, "tom"],
  [69, "tom"],
  [70, "tom"],
  [71, "tom"],
  [72, "tom"],

  [45, "ride"],
  [60, "ride"],
  [61, "ride"],
  [62, "ride"],
  [84, "ride"],
  [85, "ride"],
  [86, "ride"],

  [46, "crash"],
  [77, "crash"],
  [79, "crash"],
  [81, "crash"],
  [89, "crash"],
  [91, "crash"],
  [93, "crash"],
]);
const openHatNotes = new Set([46, 58, 76, 77]);
const addictiveDrumsOpenHatNotes = new Set([54, 55, 56, 57, 58, 59]);
const rideBellNotes = new Set([30, 53, 56, 79, 99]);
const addictiveDrumsRideBellNotes = new Set([61, 85]);
const floorTomNotes = new Set([41, 43, 45]);
const addictiveDrumsFloorTomNotes = new Set([65, 66, 67, 68]);

export function drumGroupForNote(noteNumber: number, midiMap: MidiMapMode = "gm") {
  return groupMapForMode(midiMap).get(noteNumber) ?? null;
}

export function isOpenHatNote(noteNumber: number, midiMap: MidiMapMode = "gm") {
  return (midiMap === "addictive-drums" ? addictiveDrumsOpenHatNotes : openHatNotes).has(noteNumber);
}

export function isRideBellNote(noteNumber: number, midiMap: MidiMapMode = "gm") {
  return (midiMap === "addictive-drums" ? addictiveDrumsRideBellNotes : rideBellNotes).has(noteNumber);
}

export function isFloorTomNote(noteNumber: number, midiMap: MidiMapMode = "gm") {
  return (midiMap === "addictive-drums" ? addictiveDrumsFloorTomNotes : floorTomNotes).has(noteNumber);
}

function groupMapForMode(midiMap: MidiMapMode) {
  return midiMap === "addictive-drums" ? addictiveDrumsGroupByNote : groupByNote;
}
