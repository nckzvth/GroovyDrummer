export type DrumGroup = "kick" | "snare" | "hat" | "tom" | "ride" | "crash";

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
