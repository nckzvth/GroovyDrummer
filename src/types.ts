export type DrumGroup = "kick" | "snare" | "hat" | "tom" | "ride" | "crash";
export type PreviewEngineMode = "home-kit" | "synthetic";
export type AudioExportKind = "midi" | "mix-wav" | "stems-zip";
export type SampleMic = "close" | "overheads" | "room";
export type SampleArticulation =
  | "kick"
  | "snare"
  | "snare-rim"
  | "snare-crossstick"
  | "floor-tom"
  | "rack-tom"
  | "hat-closed"
  | "hat-open"
  | "hat-pedal"
  | "ride-bow"
  | "ride-bell"
  | "ride-crash"
  | "crash-left"
  | "crash-right"
  | "stick-click";

export interface DrumMapHit {
  note: number;
  noteName: string;
  name: string;
  group: DrumGroup;
}

export interface PatternMap {
  kick: number[];
  snare: number[];
  hat: number[];
  tom: number[];
  ride: number[];
  crash: number[];
}

export interface SampleLayer {
  velocity: number;
  path: string;
}

export interface SampleManifest {
  id: "home-kit-balanced";
  name: string;
  root: string;
  sampleRate: number;
  bitDepth: number;
  layers: Record<SampleArticulation, Partial<Record<SampleMic, SampleLayer[]>>>;
}

export interface Groove {
  id: string;
  packId: string;
  packName: string;
  tempoId: string;
  tempoLabel: string;
  tempoRange: [number, number] | null;
  tempoSort: number;
  bpm: number | null;
  categoryId: string;
  categoryName: string;
  categorySort: number;
  grooveName: string;
  grooveNumber: number;
  meter: string | null;
  sourcePath: string;
  assetPath: string;
  size: number;
  duration: number;
  noteCount: number;
  hitCounts: Record<DrumGroup, number>;
  usedNotes: number[];
  pattern: PatternMap;
}

export interface TempoSummary {
  id: string;
  label: string;
  range: [number, number] | null;
  bpm: number | null;
  count: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  sort: number;
  count: number;
}

export interface PackSummary {
  id: string;
  name: string;
  count: number;
  tempos: TempoSummary[];
  categories: CategorySummary[];
}

export interface Catalog {
  appName: "GroovyDrummer";
  generatedAt: string;
  totalGrooves: number;
  gmMap: DrumMapHit[];
  packs: PackSummary[];
  grooves: Groove[];
}
