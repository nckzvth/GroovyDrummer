import { assetUrl } from "./midi";
import type { MidiMapMode, SampleArticulation, SampleLayer, SampleManifest, SampleMic } from "./types";

const manifestPath = "samples/home-kit-balanced/manifest.json";
let manifestPromise: Promise<SampleManifest> | null = null;

const noteArticulations = new Map<number, SampleArticulation>([
  [34, "kick"],
  [35, "kick"],
  [36, "kick"],

  [28, "snare"],
  [29, "snare"],
  [38, "snare"],
  [40, "snare"],
  [60, "snare"],
  [62, "snare"],
  [27, "snare-rim"],
  [37, "snare-crossstick"],
  [39, "snare-rim"],

  [22, "hat-closed"],
  [42, "hat-closed"],
  [44, "hat-pedal"],
  [46, "hat-open"],
  [58, "hat-open"],
  [66, "hat-closed"],
  [68, "hat-open"],
  [69, "hat-open"],
  [76, "hat-open"],
  [77, "hat-open"],

  [31, "rack-tom"],
  [41, "floor-tom"],
  [43, "floor-tom"],
  [45, "floor-tom"],
  [47, "rack-tom"],
  [48, "rack-tom"],
  [50, "rack-tom"],
  [65, "rack-tom"],
  [67, "rack-tom"],

  [30, "ride-bell"],
  [32, "ride-bow"],
  [51, "ride-bow"],
  [53, "ride-bell"],
  [59, "ride-bow"],
  [78, "ride-bow"],
  [79, "ride-bell"],
  [84, "ride-bow"],
  [99, "ride-bell"],

  [49, "crash-left"],
  [52, "crash-right"],
  [55, "crash-left"],
  [57, "crash-right"],
  [71, "crash-left"],
  [72, "crash-right"],
  [80, "crash-right"],

  [26, "stick-click"],
  [54, "stick-click"],
  [56, "stick-click"],
  [61, "stick-click"],
  [63, "stick-click"],
  [64, "stick-click"],
  [73, "stick-click"],
  [74, "stick-click"],
  [75, "stick-click"],
]);

const addictiveDrumsNoteArticulations = new Map<number, SampleArticulation>([
  [36, "kick"],

  [35, "snare"],
  [37, "snare-rim"],
  [38, "snare"],
  [39, "snare-rim"],
  [40, "snare"],
  [41, "snare"],
  [42, "snare-crossstick"],
  [43, "snare"],
  [44, "snare-crossstick"],

  [48, "hat-pedal"],
  [49, "hat-closed"],
  [50, "hat-closed"],
  [51, "hat-closed"],
  [52, "hat-closed"],
  [53, "hat-closed"],
  [54, "hat-open"],
  [55, "hat-open"],
  [56, "hat-open"],
  [57, "hat-open"],
  [58, "hat-open"],
  [59, "hat-open"],

  [65, "floor-tom"],
  [66, "floor-tom"],
  [67, "floor-tom"],
  [68, "floor-tom"],
  [69, "rack-tom"],
  [70, "rack-tom"],
  [71, "rack-tom"],
  [72, "rack-tom"],

  [45, "ride-bow"],
  [60, "ride-bow"],
  [61, "ride-bell"],
  [62, "ride-bow"],
  [84, "ride-bow"],
  [85, "ride-bell"],
  [86, "ride-bow"],

  [46, "crash-left"],
  [77, "crash-left"],
  [79, "crash-right"],
  [81, "crash-left"],
  [89, "crash-right"],
  [91, "crash-right"],
  [93, "crash-left"],

  [47, "stick-click"],
  [73, "stick-click"],
  [74, "stick-click"],
  [75, "stick-click"],
  [76, "stick-click"],
  [97, "stick-click"],
  [99, "stick-click"],
]);

export async function loadHomeKitManifest() {
  manifestPromise ??= fetch(assetUrl(manifestPath)).then(async (response) => {
    if (!response.ok) {
      throw new Error("Home Kit samples are missing. Run npm run prepare:home-kit.");
    }
    return response.json() as Promise<SampleManifest>;
  });
  return manifestPromise;
}

export function sampleArticulationForNote(noteNumber: number, midiMap: MidiMapMode = "gm") {
  const articulations = midiMap === "addictive-drums" ? addictiveDrumsNoteArticulations : noteArticulations;
  return articulations.get(noteNumber) ?? null;
}

export function isHatChokeArticulation(articulation: SampleArticulation) {
  return articulation === "hat-closed" || articulation === "hat-pedal";
}

export function isOpenHatArticulation(articulation: SampleArticulation) {
  return articulation === "hat-open";
}

export function chooseSampleLayer(layers: SampleLayer[], velocity: number) {
  const safeVelocity = Math.max(0.001, Math.min(1, velocity));
  const index = Math.min(layers.length - 1, Math.floor(safeVelocity * layers.length));
  return layers[index];
}

export function sampleLayerUrl(manifest: SampleManifest, layer: SampleLayer) {
  return assetUrl(`${manifest.root}/${layer.path}`);
}

export function availableMicsForArticulation(manifest: SampleManifest, articulation: SampleArticulation) {
  return Object.keys(manifest.layers[articulation] ?? {}) as SampleMic[];
}
