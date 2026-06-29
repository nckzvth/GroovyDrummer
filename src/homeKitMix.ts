import type { SampleArticulation, SampleMic } from "./types";

export const homeKitMasterLevel = -6;

export const homeKitMicLevels: Record<SampleMic, number> = {
  close: 0,
  overheads: -5,
  room: -10,
};

export const homeKitArticulationLevels: Partial<Record<SampleArticulation, number>> = {
  "hat-closed": 8,
  "hat-open": 5,
  "hat-pedal": 6,
  "ride-bow": 5,
  "ride-bell": 4,
  "ride-crash": 3,
  "crash-left": 4,
  "crash-right": 3,
  "stick-click": -6,
};

export function dbToGain(db: number) {
  return 10 ** (db / 20);
}

export function homeKitSampleGain(articulation: SampleArticulation, mic: SampleMic, velocity: number) {
  const safeVelocity = Math.max(0.02, Math.min(1, velocity));
  const level = homeKitMasterLevel + homeKitMicLevels[mic] + (homeKitArticulationLevels[articulation] ?? 0);
  return safeVelocity * dbToGain(level);
}

export function homeKitSourceGain(articulation: SampleArticulation, velocity: number) {
  const safeVelocity = Math.max(0.02, Math.min(1, velocity));
  return safeVelocity * dbToGain(homeKitArticulationLevels[articulation] ?? 0);
}
