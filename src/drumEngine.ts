import * as Tone from "tone";
import { startToneAudio } from "./audioStart";
import { drumGroupForNote, isFloorTomNote, isOpenHatNote, isRideBellNote } from "./drumMap";
import { HomeKitSampleEngine } from "./homeKitEngine";
import { loadGrooveMidi, makePlaybackSchedule } from "./midi";
import type { Groove, PreviewEngineMode } from "./types";

const syntheticSettings = { volume: -9, cymbal: 0.72, snare: 0.92, hat: 0.68, tom: 0.88 };

export const previewEngineOptions: Array<{ id: PreviewEngineMode; name: string }> = [
  { id: "home-kit", name: "Home Kit" },
  { id: "synthetic", name: "Synthetic fallback" },
];

export class DrumPreviewEngine {
  private readonly homeKit = new HomeKitSampleEngine();
  private readonly synthetic = new SyntheticDrumPreviewEngine();
  private mode: PreviewEngineMode = "home-kit";

  onStop: (() => void) | null = null;
  onStatus: ((message: string) => void) | null = null;

  constructor() {
    this.homeKit.onStop = () => {
      if (this.mode === "home-kit") {
        this.onStop?.();
      }
    };
    this.synthetic.onStop = () => {
      if (this.mode === "synthetic") {
        this.onStop?.();
      }
    };
    this.homeKit.onStatus = (message) => {
      if (this.mode === "home-kit") {
        this.onStatus?.(message);
      }
    };
  }

  async play(groove: Groove, loop: boolean, tempoOverride?: number) {
    await this.activeEngine().play(groove, loop, tempoOverride);
  }

  stop(emit = true) {
    this.homeKit.stop(false);
    this.synthetic.stop(false);

    if (emit) {
      this.onStop?.();
    }
  }

  setVolume(db: number) {
    this.homeKit.setVolume(db);
    this.synthetic.setVolume(db);
  }

  setMode(mode: PreviewEngineMode) {
    if (mode === this.mode) {
      return;
    }

    this.stop(false);
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  private activeEngine() {
    return this.mode === "home-kit" ? this.homeKit : this.synthetic;
  }
}

class SyntheticDrumPreviewEngine {
  private readonly master = new Tone.Volume(syntheticSettings.volume).toDestination();
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

  private playbackToken = 0;
  onStop: (() => void) | null = null;

  async play(groove: Groove, loop: boolean, tempoOverride?: number) {
    const token = ++this.playbackToken;
    await startToneAudio();

    const midi = await loadGrooveMidi(groove);
    if (token !== this.playbackToken) {
      return;
    }

    this.clearTransport();

    const schedule = makePlaybackSchedule(groove, midi, tempoOverride);
    const notes = schedule.notes
      .filter((note) => drumGroupForNote(note.midi, groove.midiMap) !== null);

    Tone.Transport.bpm.value = schedule.tempo;
    Tone.Transport.loop = loop;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = schedule.duration;
    Tone.Transport.seconds = 0;

    for (const note of notes) {
      Tone.Transport.schedule((time) => {
        this.trigger(note.midi, groove.midiMap, time, note.velocity || 0.65);
      }, note.time);
    }

    if (!loop) {
      Tone.Transport.scheduleOnce(() => {
        if (this.playbackToken === token) {
          this.stop();
        }
      }, schedule.duration + 0.05);
    }

    Tone.Transport.start("+0.03");
  }

  stop(emit = true) {
    this.playbackToken += 1;
    this.clearTransport();

    if (emit) {
      this.onStop?.();
    }
  }

  private clearTransport() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.loop = false;
  }

  setVolume(db: number) {
    this.master.volume.value = db;
  }

  private trigger(noteNumber: number, midiMap: Groove["midiMap"], time: number, velocity: number) {
    const v = Math.max(0.08, Math.min(1, velocity));
    const group = drumGroupForNote(noteNumber, midiMap);

    if (!group) {
      return;
    }

    switch (group) {
      case "kick":
        this.kick.triggerAttackRelease("C1", 0.12, time, v);
        break;
      case "snare": {
        const rimScale = [27, 37, 39].includes(noteNumber) ? 0.72 : 1;
        this.snareBody.triggerAttackRelease("D2", 0.08, time, v * 0.55 * syntheticSettings.snare * rimScale);
        this.snareNoise.triggerAttackRelease(0.08, time, v * syntheticSettings.snare * rimScale);
        break;
      }
      case "hat":
        if (isOpenHatNote(noteNumber, midiMap)) {
          this.hatOpen.triggerAttackRelease(0.22, time, v * syntheticSettings.hat);
        } else {
          this.hatClosed.triggerAttackRelease(0.028, time, v * syntheticSettings.hat);
        }
        break;
      case "tom":
        if (!isFloorTomNote(noteNumber, midiMap)) {
          this.tomRack.triggerAttackRelease(noteNumber >= 50 ? "D2" : "C2", 0.15, time, v * syntheticSettings.tom);
        } else {
          this.tomFloor.triggerAttackRelease(noteNumber <= 41 ? "F1" : "G1", 0.2, time, v * syntheticSettings.tom);
        }
        break;
      case "ride":
        if (isRideBellNote(noteNumber, midiMap)) {
          this.rideBell.triggerAttackRelease("G5", 0.08, time, v * 0.55);
        } else {
          this.cymbal.triggerAttackRelease(0.42, time, v * 0.44 * syntheticSettings.cymbal);
        }
        break;
      case "crash":
        this.cymbal.triggerAttackRelease(0.64, time, v * 0.68 * syntheticSettings.cymbal);
        break;
    }
  }
}
