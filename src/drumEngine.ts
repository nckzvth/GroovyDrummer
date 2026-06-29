import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { Groove } from "./types";

type MidiInstance = InstanceType<typeof Midi>;

type KitId = "studio" | "tight" | "room";

const kitSettings: Record<KitId, { volume: number; cymbal: number; snare: number; hat: number; tom: number }> = {
  studio: { volume: -7, cymbal: 0.72, snare: 0.92, hat: 0.68, tom: 0.88 },
  tight: { volume: -6, cymbal: 0.45, snare: 1, hat: 0.55, tom: 0.72 },
  room: { volume: -9, cymbal: 0.95, snare: 0.78, hat: 0.8, tom: 1 },
};

export const kitOptions: Array<{ id: KitId; name: string }> = [
  { id: "studio", name: "Studio GM" },
  { id: "tight", name: "Tight Room" },
  { id: "room", name: "Wide Room" },
];

const midiCache = new Map<string, MidiInstance>();

function assetUrl(assetPath: string) {
  return new URL(assetPath, window.location.href).toString();
}

export class DrumPreviewEngine {
  private readonly master = new Tone.Volume(kitSettings.studio.volume).toDestination();
  private readonly kick = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 7,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.04 },
  }).connect(this.master);
  private readonly snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.015,
    octaves: 2.4,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.04 },
  }).connect(this.master);
  private readonly snareFilter = new Tone.Filter(1600, "highpass").connect(this.master);
  private readonly snareNoise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.04 },
  }).connect(this.snareFilter);
  private readonly hatFilter = new Tone.Filter(7400, "highpass").connect(this.master);
  private readonly hatClosed = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 },
  }).connect(this.hatFilter);
  private readonly hatOpen = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0.02, release: 0.08 },
  }).connect(this.hatFilter);
  private readonly tomRack = new Tone.MembraneSynth({
    pitchDecay: 0.035,
    octaves: 3.5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.26, sustain: 0, release: 0.08 },
  }).connect(this.master);
  private readonly tomFloor = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.1 },
  }).connect(this.master);
  private readonly rideBell = new Tone.Synth({
    oscillator: { type: "triangle8" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
  }).connect(this.master);
  private readonly cymbalFilter = new Tone.Filter(5200, "highpass").connect(this.master);
  private readonly cymbal = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.002, decay: 0.72, sustain: 0.02, release: 0.16 },
  }).connect(this.cymbalFilter);

  private kit: KitId = "studio";
  private playbackToken = 0;
  onStop: (() => void) | null = null;

  async play(groove: Groove, loop: boolean) {
    const token = ++this.playbackToken;
    await Tone.start();

    const midi = await this.loadMidi(groove);
    if (token !== this.playbackToken) {
      return;
    }

    this.stop(false);

    const notes = midi.tracks.flatMap((track) => track.notes);
    const duration = Math.max(midi.duration || groove.duration || 0, 0.25);
    const tempo = midi.header.tempos[0]?.bpm ?? groove.bpm ?? 120;

    Tone.Transport.bpm.value = tempo;
    Tone.Transport.loop = loop;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = duration;
    Tone.Transport.seconds = 0;

    for (const note of notes) {
      Tone.Transport.schedule((time) => {
        this.trigger(note.midi, time, note.velocity || 0.65);
      }, note.time);
    }

    if (!loop) {
      Tone.Transport.scheduleOnce(() => {
        if (this.playbackToken === token) {
          this.stop();
        }
      }, duration + 0.05);
    }

    Tone.Transport.start("+0.03");
  }

  stop(emit = true) {
    this.playbackToken += 1;
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.loop = false;

    if (emit) {
      this.onStop?.();
    }
  }

  setVolume(db: number) {
    this.master.volume.value = db;
  }

  setKit(kit: KitId) {
    this.kit = kit;
    this.master.volume.value = kitSettings[kit].volume;
  }

  private async loadMidi(groove: Groove) {
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

  private trigger(noteNumber: number, time: number, velocity: number) {
    const v = Math.max(0.08, Math.min(1, velocity));
    const kit = kitSettings[this.kit];

    switch (noteNumber) {
      case 36:
        this.kick.triggerAttackRelease("C1", 0.12, time, v);
        break;
      case 38:
        this.snareBody.triggerAttackRelease("D2", 0.08, time, v * 0.55 * kit.snare);
        this.snareNoise.triggerAttackRelease(0.08, time, v * kit.snare);
        break;
      case 42:
      case 44:
      case 54:
        this.hatClosed.triggerAttackRelease(0.028, time, v * kit.hat);
        break;
      case 46:
      case 58:
        this.hatOpen.triggerAttackRelease(0.22, time, v * kit.hat);
        break;
      case 50:
      case 48:
        this.tomRack.triggerAttackRelease(noteNumber === 50 ? "D2" : "C2", 0.15, time, v * kit.tom);
        break;
      case 43:
      case 41:
        this.tomFloor.triggerAttackRelease(noteNumber === 43 ? "G1" : "F1", 0.2, time, v * kit.tom);
        break;
      case 53:
        this.rideBell.triggerAttackRelease("G5", 0.08, time, v * 0.55);
        break;
      case 51:
        this.cymbal.triggerAttackRelease(0.42, time, v * 0.44 * kit.cymbal);
        break;
      case 49:
      case 52:
      case 55:
      case 57:
        this.cymbal.triggerAttackRelease(0.64, time, v * 0.68 * kit.cymbal);
        break;
      default:
        this.tomRack.triggerAttackRelease("A1", 0.09, time, v * 0.45);
        break;
    }
  }
}
