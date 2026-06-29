import drumMapData from "./drum-map.json";
import type { DrumGroup, DrumMapHit } from "./types";

export const drumMap: DrumMapHit[] = drumMapData.map((hit) => ({
  ...hit,
  group: hit.group as DrumGroup,
}));

const groupByNote = new Map<number, DrumGroup>(drumMap.map((hit) => [hit.note, hit.group]));
const openHatNotes = new Set([46, 58, 76, 77]);
const rideBellNotes = new Set([30, 53, 56, 79, 99]);

export function drumGroupForNote(noteNumber: number) {
  return groupByNote.get(noteNumber) ?? null;
}

export function isOpenHatNote(noteNumber: number) {
  return openHatNotes.has(noteNumber);
}

export function isRideBellNote(noteNumber: number) {
  return rideBellNotes.has(noteNumber);
}
