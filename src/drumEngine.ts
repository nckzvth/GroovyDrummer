import { Midi } from "@tonejs/midi";
import crash from "@teropa/drumkit/dist/assets/crash.mp3";
import hatClosed from "@teropa/drumkit/dist/assets/hatClosed.mp3";
import hatClosed2 from "@teropa/drumkit/dist/assets/hatClosed2.mp3";
import hatOpen from "@teropa/drumkit/dist/assets/hatOpen.mp3";
import hatOpen2 from "@teropa/drumkit/dist/assets/hatOpen2.mp3";
import kick from "@teropa/drumkit/dist/assets/kick.mp3";
import ride from "@teropa/drumkit/dist/assets/ride.mp3";
import snare from "@teropa/drumkit/dist/assets/snare.mp3";
import tomHigh from "@teropa/drumkit/dist/assets/tomHigh.mp3";
import tomLow from "@teropa/drumkit/dist/assets/tomLow.mp3";
import tomMid from "@teropa/drumkit/dist/assets/tomMid.mp3";
import * as Tone from "tone";
import type { Groove } from "./types";

type MidiInstance = InstanceType<typeof Midi>;

export type KitId = "sampled" | "studio" | "tight" | "room";

const kitSettings: Record<KitId, { volume: number; cymbal: number; snare: number; hat: number; tom: number }> = {
  sampled: { volume: -5, cymbal: 0.82, snare: 1, hat: 0.82, tom: 0.9 },
  studio: { volume: -7, cymbal: 0.72, snare: 0.92, hat: 0.68, tom: 0.88 },
  tight: { volume: -6, cymbal: 0.45, snare: 1, hat: 0.55, tom: 0.72 },
  room: { volume: -9, cymbal: 0.95, snare: 0.78, hat: 0.8, tom: 1 },
};

export const kitOptions: Array<{ id: KitId; name: string }> = [
  { id: "sampled", name: "Sampled Acoustic" },
  { id: "studio", name: "Studio GM" },
  { id: "tight", name: "Tight Room" },
  { id: "room", name: "Wide Room" },
];

const midiCache = new Map<string, MidiInstance>();

function assetUrl(assetPath: string) {
  return new URL(assetPath, window.location.href).toString();
}

const gmNoteNames: Record<number, string> = {
  36: "C1",
  38: "D1",
  41: "F1",
  42: "F#1",
  43: "G1",
  44: "G#1",
  46: "A#1",
  48: "C2",
  49: "C#2",
  50: "D2",
  51: "D#2",
  52: "E2",
  53: "F2",
  54: "F#2",
  55: "G2",
  57: "A2",
  58: "A#2",
};

const sampledDrumUrls: Record<string, string> = {
  C1: kick,
  D1: snare,
  F1: tomLow,
  "F#1": hatClosed,
  G1: tomMid,
  "G#1": hatClosed2,
  "A#1": hatOpen,
  C2: tomLow,
  "C#2": crash,
  D2: tomHigh,
  "D#2": ride,
  E2: crash,
  F2: ride,
  "F#2": hatClosed2,
  G2: crash,
  A2: crash,
  "A#2": hatOpen2,
};

export class DrumPreviewEngine {
  private sampleKitResolve: (() => void) | null = null;
  private sampleKitReject: ((error: Error) => void) | null = null;
  private readonly sampleKitReady = new Promise<void>((resolve, reject) => {
    this.sampleKitResolve = resolve;
    this.sampleKitReject = reject;
  });

  private readonly master = new Tone.Volume(kitSettings.sampled.volume).toDestination();
  private readonly sampleKit = new Tone.Sampler({
    urls: sampledDrumUrls,
    attack: 0.001,
    release: 1.1,
    onload: () => this.sampleKitResolve?.(),
    onerror: (error) => this.sampleKitReject?.(error),
  }).connect(this.master);
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

  private kit: KitId = "sampled";
  private playbackToken = 0;
  onStop: (() => void) | null = null;

  async play(groove: Groove, loop: boolean, tempoOverride?: number) {
    const token = ++this.playbackToken;
    await Tone.start();
    if (this.kit === "sampled") {
      await this.sampleKitReady;
    }

    const midi = await this.loadMidi(groove);
    if (token !== this.playbackToken) {
      return;
    }

    this.stop(false);

    const notes = midi.tracks.flatMap((track) => track.notes);
    const originalTempo = midi.header.tempos[0]?.bpm ?? groove.bpm ?? 120;
    const tempo = tempoOverride ?? originalTempo;
    const timeScale = originalTempo / tempo;
    const duration = Math.max(midi.duration || groove.duration || 0, 0.25) * timeScale;

    Tone.Transport.bpm.value = tempo;
    Tone.Transport.loop = loop;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = duration;
    Tone.Transport.seconds = 0;

    for (const note of notes) {
      Tone.Transport.schedule((time) => {
        this.trigger(note.midi, time, note.velocity || 0.65);
      }, note.time * timeScale);
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
    this.sampleKit.releaseAll();

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

    if (this.kit === "sampled") {
      this.triggerSample(noteNumber, time, v);
      return;
    }

    this.triggerSynth(noteNumber, time, v);
  }

  private triggerSample(noteNumber: number, time: number, velocity: number) {
    const noteName = gmNoteNames[noteNumber];
    if (!noteName) {
      return;
    }

    const kit = kitSettings.sampled;
    const groupScale = this.sampleVelocityScale(noteNumber, kit);
    this.sampleKit.triggerAttack(noteName, time, Math.min(1, velocity * groupScale));
  }

  private sampleVelocityScale(noteNumber: number, kit: typeof kitSettings.sampled) {
    if (noteNumber === 38) {
      return kit.snare;
    }
    if ([42, 44, 46, 54, 58].includes(noteNumber)) {
      return kit.hat;
    }
    if ([41, 43, 48, 50].includes(noteNumber)) {
      return kit.tom;
    }
    if ([49, 51, 52, 53, 55, 57].includes(noteNumber)) {
      return kit.cymbal;
    }
    return 1;
  }

  private triggerSynth(noteNumber: number, time: number, velocity: number) {
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
