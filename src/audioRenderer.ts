import {
  availableMicsForArticulation,
  chooseSampleLayer,
  isHatChokeArticulation,
  isOpenHatArticulation,
  loadHomeKitManifest,
  sampleArticulationForNote,
  sampleLayerUrl,
} from "./homeKitSamples";
import { loadGrooveMidi, makePlaybackSchedule } from "./midi";
import { encodeWav24 } from "./wavEncoder";
import type { Groove, SampleArticulation, SampleManifest, SampleMic } from "./types";

export type StemTarget =
  | "full-kit"
  | "kick-close"
  | "snare-close"
  | "rack-tom-close"
  | "floor-tom-close"
  | "overheads"
  | "room";

type RenderEvent = {
  articulation: SampleArticulation;
  time: number;
  velocity: number;
  stopTime: number | null;
};

const sampleRate = 44100;
const renderTailSeconds = 4;

const micLevels: Record<SampleMic, number> = {
  close: 0,
  overheads: -8,
  room: -12,
};

const articulationLevels: Partial<Record<SampleArticulation, number>> = {
  "hat-closed": -3,
  "hat-open": -4,
  "hat-pedal": -5,
  "ride-bow": -3,
  "ride-bell": -4,
  "ride-crash": -5,
  "crash-left": -5,
  "crash-right": -5,
  "stick-click": -8,
};

let decodeContext: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();

export async function renderGrooveWavBlob(groove: Groove, tempo: number, target: StemTarget) {
  const audioBuffer = await renderGrooveAudio(groove, tempo, target);
  return encodeWav24(audioBuffer);
}

export async function renderGrooveStems(groove: Groove, tempo: number) {
  const targets: Array<{ target: StemTarget; fileName: string }> = [
    { target: "kick-close", fileName: "kick-close.wav" },
    { target: "snare-close", fileName: "snare-close.wav" },
    { target: "rack-tom-close", fileName: "rack-tom-close.wav" },
    { target: "floor-tom-close", fileName: "floor-tom-close.wav" },
    { target: "overheads", fileName: "overheads.wav" },
    { target: "room", fileName: "room.wav" },
    { target: "full-kit", fileName: "full-kit.wav" },
  ];

  const files: Array<{ fileName: string; blob: Blob }> = [];
  for (const item of targets) {
    files.push({
      fileName: item.fileName,
      blob: await renderGrooveWavBlob(groove, tempo, item.target),
    });
  }
  return files;
}

async function renderGrooveAudio(groove: Groove, tempo: number, target: StemTarget) {
  const [manifest, midi] = await Promise.all([loadHomeKitManifest(), loadGrooveMidi(groove)]);
  const schedule = makePlaybackSchedule(groove, midi, tempo);
  const events = withHatStops(schedule.notes.reduce<RenderEvent[]>((mapped, note) => {
    const articulation = sampleArticulationForNote(note.midi, groove.midiMap);
    if (articulation) {
      mapped.push({
        articulation,
        time: note.time,
        velocity: note.velocity,
        stopTime: null,
      });
    }
    return mapped;
  }, []));

  await preloadTargetSamples(manifest, events, target);

  const duration = schedule.duration + renderTailSeconds;
  const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

  for (const event of events) {
    for (const mic of targetMics(manifest, event.articulation, target)) {
      const layers = manifest.layers[event.articulation][mic] ?? [];
      if (!layers.length) {
        continue;
      }

      const layer = chooseSampleLayer(layers, event.velocity);
      const audioBuffer = await loadBuffer(sampleLayerUrl(manifest, layer));
      const source = context.createBufferSource();
      const gain = context.createGain();
      const articulationGain = dbToGain(articulationLevels[event.articulation] ?? 0);

      source.buffer = audioBuffer;
      gain.gain.value = Math.max(0.02, Math.min(1, event.velocity)) * dbToGain(micLevels[mic]) * dbToGain(-6) * articulationGain;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(event.time);

      if (event.stopTime !== null && event.stopTime > event.time) {
        source.stop(event.stopTime);
      }
    }
  }

  return context.startRendering();
}

async function preloadTargetSamples(manifest: SampleManifest, events: RenderEvent[], target: StemTarget) {
  const urls = new Set<string>();
  for (const event of events) {
    for (const mic of targetMics(manifest, event.articulation, target)) {
      const layers = manifest.layers[event.articulation][mic] ?? [];
      const layer = layers.length ? chooseSampleLayer(layers, event.velocity) : null;
      if (layer) {
        urls.add(sampleLayerUrl(manifest, layer));
      }
    }
  }
  await Promise.all([...urls].map((url) => loadBuffer(url)));
}

function targetMics(manifest: SampleManifest, articulation: SampleArticulation, target: StemTarget) {
  const available = availableMicsForArticulation(manifest, articulation);
  if (target === "full-kit") {
    return available;
  }
  if (target === "overheads") {
    return available.includes("overheads") ? ["overheads" as const] : [];
  }
  if (target === "room") {
    return available.includes("room") ? ["room" as const] : [];
  }
  if (target === "kick-close") {
    return articulation === "kick" && available.includes("close") ? ["close" as const] : [];
  }
  if (target === "snare-close") {
    return ["snare", "snare-rim", "snare-crossstick"].includes(articulation) && available.includes("close")
      ? ["close" as const]
      : [];
  }
  if (target === "rack-tom-close") {
    return articulation === "rack-tom" && available.includes("close") ? ["close" as const] : [];
  }
  return articulation === "floor-tom" && available.includes("close") ? ["close" as const] : [];
}

function withHatStops(events: RenderEvent[]) {
  const sorted = events.sort((a, b) => a.time - b.time);

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    if (!isOpenHatArticulation(event.articulation)) {
      continue;
    }

    const choke = sorted.slice(index + 1).find((candidate) => isHatChokeArticulation(candidate.articulation));
    event.stopTime = choke?.time ?? null;
  }

  return sorted;
}

function loadBuffer(url: string) {
  const cached = bufferCache.get(url);
  if (cached) {
    return cached;
  }

  const promise = fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Unable to load sample ${url.split("/").pop() ?? url}`);
    }
    return getDecodeContext().decodeAudioData(await response.arrayBuffer());
  });
  bufferCache.set(url, promise);
  return promise;
}

function dbToGain(db: number) {
  return 10 ** (db / 20);
}

function getDecodeContext() {
  decodeContext ??= new AudioContext({ sampleRate });
  return decodeContext;
}
