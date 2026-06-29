import { Midi } from "@tonejs/midi";
import type { Groove } from "./types";

type MidiInstance = InstanceType<typeof Midi>;

export type ScheduledMidiNote = {
  midi: number;
  time: number;
  velocity: number;
};

export type PlaybackSchedule = {
  notes: ScheduledMidiNote[];
  originalTempo: number;
  tempo: number;
  duration: number;
};

const midiCache = new Map<string, MidiInstance>();

export function assetUrl(assetPath: string) {
  return new URL(assetPath, window.location.href).toString();
}

export async function loadGrooveMidi(groove: Groove) {
  const cached = midiCache.get(groove.assetPath);
  if (cached) {
    return cached;
  }

  const response = await fetch(assetUrl(groove.assetPath));
  if (!response.ok) {
    throw new Error(`Unable to load ${groove.grooveName}`);
  }

  const midi = new Midi(await response.arrayBuffer());
  midiCache.set(groove.assetPath, midi);
  return midi;
}

export function makePlaybackSchedule(groove: Groove, midi: MidiInstance, tempoOverride?: number): PlaybackSchedule {
  const rawNotes = midi.tracks.flatMap((track) => track.notes);
  const originalTempo = midi.header.tempos[0]?.bpm ?? groove.bpm ?? 120;
  const tempo = tempoOverride ?? originalTempo;

  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error("Tempo must be above 0 BPM");
  }

  const timeScale = originalTempo / tempo;
  const midiDuration = midi.duration || rawNotes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
  const duration = Math.max(midiDuration || groove.duration || 0, 0.25) * timeScale;

  return {
    notes: rawNotes.map((note) => ({
      midi: note.midi,
      time: note.time * timeScale,
      velocity: note.velocity || 0.65,
    })),
    originalTempo,
    tempo,
    duration,
  };
}
