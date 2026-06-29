export const sampleRootDirName = "Strike Sound - Home Kit - WAV";
export const publicSampleDir = "samples/home-kit-balanced";

const layers32 = [4, 8, 12, 16, 20, 24, 28, 32];
const layers16 = [4, 8, 12, 16];
const layers8 = [2, 4, 6, 8];

export const homeKitSources = [
  {
    articulation: "kick",
    mics: {
      close: { folder: "Kick", prefix: "KickDirect", layers: layers32 },
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Kick", layers: layers32 },
      room: { folder: "Room (Mono)", prefix: "Room_Kick", layers: layers32 },
    },
  },
  {
    articulation: "snare",
    mics: {
      close: { folder: "Snare", prefix: "Snare", layers: layers32 },
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Snare", layers: layers32 },
      room: { folder: "Room (Mono)", prefix: "Room_Snare", layers: layers32 },
    },
  },
  {
    articulation: "snare-rim",
    mics: {
      close: { folder: "Snare", prefix: "Snare_RimClick", layers: layers8 },
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Snare_RimClick", layers: layers8 },
      room: { folder: "Room (Mono)", prefix: "Room_Snare_RimClick", layers: layers8 },
    },
  },
  {
    articulation: "snare-crossstick",
    mics: {
      close: { folder: "Snare", prefix: "Snare_CrossStick", layers: layers8 },
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Snare_CrossStick", layers: layers8 },
      room: { folder: "Room (Mono)", prefix: "Room_Snare_CrossStick", layers: layers8 },
    },
  },
  {
    articulation: "floor-tom",
    mics: {
      close: { folder: "Floor Tom", prefix: "FloorDirect", layers: layers32 },
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Floor", layers: layers32 },
      room: { folder: "Room (Mono)", prefix: "Room_Floor", layers: layers32 },
    },
  },
  {
    articulation: "rack-tom",
    mics: {
      close: { folder: "Rack Tom", prefix: "RackDirect", layers: layers32 },
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Rack", layers: layers32 },
      room: { folder: "Room (Mono)", prefix: "Room_Rack", layers: layers32 },
    },
  },
  {
    articulation: "hat-closed",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Hihat_Closed", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_HiHat_Closed", layers: layers16 },
    },
  },
  {
    articulation: "hat-open",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Hihat_Open", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_HiHat_Open", layers: layers16 },
    },
  },
  {
    articulation: "hat-pedal",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Hihat_Pedal", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_HiHat_Pedal", layers: layers16 },
    },
  },
  {
    articulation: "ride-bow",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Ride_Bow", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_Ride_Bow", layers: layers16 },
    },
  },
  {
    articulation: "ride-bell",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Ride_Bell", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_Ride_Bell", layers: layers16 },
    },
  },
  {
    articulation: "ride-crash",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_Ride_Crashed", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_Ride_Crashed", layers: layers16 },
    },
  },
  {
    articulation: "crash-left",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_CrashL", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_CrashL", layers: layers16 },
    },
  },
  {
    articulation: "crash-right",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_CrashR", layers: layers16 },
      room: { folder: "Room (Mono)", prefix: "Room_CrashR", layers: layers16 },
    },
  },
  {
    articulation: "stick-click",
    mics: {
      overheads: { folder: "Overheads (Spaced Pair)", prefix: "OH_StickClick", layers: layers8 },
      room: { folder: "Room (Mono)", prefix: "Room_StickClick", layers: layers8 },
    },
  },
];

export function layerFileName(prefix, number) {
  return `${prefix}-${String(number).padStart(3, "0")}.wav`;
}

export function normalizedFileName(mic, number) {
  return `${mic}-${String(number).padStart(3, "0")}.wav`;
}
