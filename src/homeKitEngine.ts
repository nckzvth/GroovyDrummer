import * as Tone from "tone";
import { startToneAudio } from "./audioStart";
import {
  availableMicsForArticulation,
  chooseSampleLayer,
  isHatChokeArticulation,
  isOpenHatArticulation,
  loadHomeKitManifest,
  sampleArticulationForNote,
  sampleLayerUrl,
} from "./homeKitSamples";
import { homeKitMicLevels, homeKitMasterLevel, homeKitSourceGain } from "./homeKitMix";
import { loadGrooveMidi, makePlaybackSchedule } from "./midi";
import type { Groove, SampleArticulation, SampleManifest, SampleMic } from "./types";

export class HomeKitSampleEngine {
  private readonly context = Tone.getContext().rawContext as AudioContext;
  private readonly master = this.context.createGain();
  private readonly micBuses: Record<SampleMic, GainNode> = {
    close: this.context.createGain(),
    overheads: this.context.createGain(),
    room: this.context.createGain(),
  };

  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly activeSources = new Set<AudioBufferSourceNode>();
  private readonly openHatSources = new Set<AudioBufferSourceNode>();
  private manifest: SampleManifest | null = null;
  private playbackToken = 0;

  onStop: (() => void) | null = null;
  onStatus: ((message: string) => void) | null = null;

  constructor() {
    this.master.gain.value = dbToGain(homeKitMasterLevel);
    this.master.connect(this.context.destination);

    for (const mic of Object.keys(this.micBuses) as SampleMic[]) {
      this.micBuses[mic].gain.value = dbToGain(homeKitMicLevels[mic]);
      this.micBuses[mic].connect(this.master);
    }
  }

  async play(groove: Groove, loop: boolean, tempoOverride?: number) {
    const token = ++this.playbackToken;
    this.onStatus?.("Starting audio");
    await startToneAudio();

    this.onStatus?.("Loading MIDI");
    const midi = await loadGrooveMidi(groove);
    if (token !== this.playbackToken) {
      return;
    }

    const schedule = makePlaybackSchedule(groove, midi, tempoOverride);
    const events = schedule.notes
      .map((note) => ({
        ...note,
        articulation: sampleArticulationForNote(note.midi, groove.midiMap),
      }))
      .filter((event): event is typeof event & { articulation: SampleArticulation } => event.articulation !== null);

    this.onStatus?.("Loading samples");
    await this.ensureEvents(events);
    if (token !== this.playbackToken) {
      return;
    }

    this.clearTransport();

    Tone.Transport.bpm.value = schedule.tempo;
    Tone.Transport.loop = loop;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = schedule.duration;
    Tone.Transport.seconds = 0;

    for (const event of events) {
      Tone.Transport.schedule((time) => {
        this.trigger(event.articulation, time, event.velocity);
      }, event.time);
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
    this.stopActiveSources();

    if (emit) {
      this.onStop?.();
    }
  }

  setVolume(db: number) {
    this.master.gain.value = dbToGain(db);
  }

  private async ensureEvents(events: Array<{ articulation: SampleArticulation; velocity: number }>) {
    const manifest = await loadHomeKitManifest();
    this.manifest = manifest;
    const urls = new Set<string>();

    for (const event of events) {
      for (const mic of availableMicsForArticulation(manifest, event.articulation)) {
        const layers = manifest.layers[event.articulation][mic] ?? [];
        for (const layer of layers) {
          if (layer === chooseSampleLayer(layers, event.velocity)) {
            urls.add(sampleLayerUrl(manifest, layer));
          }
        }
      }
    }

    const urlList = [...urls];
    let loaded = 0;

    await Promise.all(urlList.map(async (url) => {
      await this.loadBuffer(url);
      loaded += 1;
      this.onStatus?.(`Loading samples ${loaded}/${urlList.length}`);
    }));
  }

  private loadBuffer(url: string) {
    const cached = this.buffers.get(url);
    if (cached) {
      return cached;
    }

    const promise = withTimeout(fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load sample ${url.split("/").pop() ?? url}`);
      }
      return this.context.decodeAudioData(await response.arrayBuffer());
    }), `Timed out loading sample ${url.split("/").pop() ?? url}`);
    this.buffers.set(url, promise);
    return promise;
  }

  private trigger(articulation: SampleArticulation, time: number, velocity: number) {
    if (!this.manifest) {
      return;
    }

    if (isHatChokeArticulation(articulation)) {
      this.stopOpenHats(time);
    }

    for (const mic of availableMicsForArticulation(this.manifest, articulation)) {
      const layers = this.manifest.layers[articulation][mic] ?? [];
      if (!layers.length) {
        continue;
      }

      const layer = chooseSampleLayer(layers, velocity);
      const buffer = this.buffers.get(sampleLayerUrl(this.manifest, layer));
      if (!buffer) {
        continue;
      }

      void buffer.then((audioBuffer) => {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        const safeTime = Math.max(time, this.context.currentTime);

        source.buffer = audioBuffer;
        gain.gain.setValueAtTime(homeKitSourceGain(articulation, velocity), safeTime);
        source.connect(gain);
        gain.connect(this.micBuses[mic]);
        source.onended = () => {
          this.activeSources.delete(source);
          this.openHatSources.delete(source);
        };

        this.activeSources.add(source);
        if (isOpenHatArticulation(articulation)) {
          this.openHatSources.add(source);
        }
        source.start(safeTime);
      });
    }
  }

  private stopOpenHats(time: number) {
    for (const source of [...this.openHatSources]) {
      try {
        source.stop(Math.max(time, this.context.currentTime));
      } catch {
        // Already stopped.
      }
      this.openHatSources.delete(source);
    }
  }

  private stopActiveSources() {
    for (const source of [...this.activeSources]) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.activeSources.clear();
    this.openHatSources.clear();
  }

  private clearTransport() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.loop = false;
  }
}

function dbToGain(db: number) {
  return 10 ** (db / 20);
}

function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), 15000);
    }),
  ]);
}
