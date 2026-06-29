import midiPackage from "@tonejs/midi";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");
const midiOutDir = path.join(publicDir, "midi");
const catalogPath = path.join(publicDir, "catalog.json");
const archiveDirName = "800000_Drum_Percussion_MIDI_Archive[6_19_15]";
const terminusDirName = "Terminus Metal MIDIPack";
const execFileAsync = promisify(execFile);
const { Midi } = midiPackage;
const gmMap = JSON.parse(await readFile(path.join(rootDir, "src", "drum-map.json"), "utf8"));

const gmGroups = new Map(gmMap.map((hit) => [hit.note, hit.group]));
const addictiveDrumsGroups = new Map([
  [36, "kick"],

  [35, "snare"],
  [37, "snare"],
  [38, "snare"],
  [39, "snare"],
  [40, "snare"],
  [41, "snare"],
  [42, "snare"],
  [43, "snare"],
  [44, "snare"],

  [48, "hat"],
  [49, "hat"],
  [50, "hat"],
  [51, "hat"],
  [52, "hat"],
  [53, "hat"],
  [54, "hat"],
  [55, "hat"],
  [56, "hat"],
  [57, "hat"],
  [58, "hat"],
  [59, "hat"],

  [65, "tom"],
  [66, "tom"],
  [67, "tom"],
  [68, "tom"],
  [69, "tom"],
  [70, "tom"],
  [71, "tom"],
  [72, "tom"],

  [45, "ride"],
  [60, "ride"],
  [61, "ride"],
  [62, "ride"],
  [84, "ride"],
  [85, "ride"],
  [86, "ride"],

  [46, "crash"],
  [77, "crash"],
  [79, "crash"],
  [81, "crash"],
  [89, "crash"],
  [91, "crash"],
  [93, "crash"],
]);
const patternGroups = ["kick", "snare", "hat", "tom", "ride", "crash"];
const groovyDrummerPackId = "groovy-drummer";
const groovyDrummerPackName = "GroovyDrummer";

const drumNotes = {
  kick: 36,
  snare: 38,
  snareAlt: 40,
  hatClosed: 42,
  hatPedal: 44,
  hatOpen: 46,
  crashLeft: 49,
  crashRight: 57,
  ride: 51,
  rideCrash: 59,
  rideBell: 53,
  floorTom: 43,
  lowFloorTom: 41,
  rackTom: 48,
  highTom: 50,
};

const groovyDrummerCategoryOrder = new Map([
  ["Main Grooves", 1],
  ["Backbeats", 2],
  ["Blast Beats", 3],
  ["Fills", 4],
  ["Intros / Stops", 5],
]);

const groovyDrummerFamilies = [
  {
    name: "Chain Sprint",
    bpm: 232,
    surface: "hatClosed",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.78,
    blastStyle: "alternating",
    introName: "Crash Count-In",
    introStyle: "crash-count",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], openHatBeats: [3.5] },
      ],
    },
    backbeat: {
      surface: "hatClosed",
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], openHatBeats: [3.5] },
      ],
    },
    fills: [
      { name: "Floor Tom Turnaround", style: "floor-turnaround" },
      { name: "Snare Push Fill", style: "snare-push" },
    ],
  },
  {
    name: "D-Beat Battery",
    bpm: 220,
    surface: "ride",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.76,
    blastStyle: "dbeat",
    introName: "D-Beat Pickup",
    introStyle: "dbeat-pickup",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3] },
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3], crashRideBeats: [0], bellBeats: [3.5] },
      ],
    },
    backbeat: {
      surface: "ride",
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3], crashRideBeats: [0], bellBeats: [3.5] },
      ],
    },
    fills: [
      { name: "Rack-To-Floor Fill", style: "rack-floor" },
      { name: "Crash Stop Fill", style: "crash-stop" },
    ],
  },
  {
    name: "Discharge Drive",
    bpm: 165,
    surface: "hatOpen",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.86,
    blastStyle: "dbeat-open",
    introName: "Open-Hat Count",
    introStyle: "open-hat-count",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3], crashBeats: [0] },
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3], crashBeats: [0] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], crashBeats: [0] },
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3], crashBeats: [0, 3.5] },
      ],
    },
    backbeat: {
      surface: "hatOpen",
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3], crashBeats: [0] },
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3], crashBeats: [0] },
      ],
    },
    fills: [
      { name: "Open-Hat Turnaround", style: "open-hat-turnaround" },
      { name: "D-Beat Snare Walk", style: "dbeat-snare-walk" },
    ],
  },
  {
    name: "Hardcore Stomp",
    bpm: 185,
    surface: "rideCrash",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.84,
    blastStyle: "hardcore",
    introName: "Mosh Pickup",
    introStyle: "mosh-pickup",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3], crashRideBeats: [0, 2] },
        { kicks: [0, 0.5, 1.5, 2, 3.5], snares: [1, 3], crashRideBeats: [0] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3], crashRideBeats: [0, 2] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], crashRideBeats: [0, 3] },
      ],
    },
    backbeat: {
      surface: "rideCrash",
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3], crashRideBeats: [0] },
        { kicks: [0, 1.5, 2, 3.5], snares: [1, 3], crashRideBeats: [0, 2] },
      ],
    },
    fills: [
      { name: "Mosh Tom Walk", style: "mosh-tom-walk" },
      { name: "Hardcore Stop Fill", style: "hardcore-stop" },
    ],
  },
  {
    name: "Fastcore Sprint",
    bpm: 244,
    surface: "hatClosed",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.8,
    blastStyle: "hammer",
    introName: "Fastcore Chokes",
    introStyle: "fastcore-chokes",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], openHatBeats: [3.5] },
      ],
    },
    backbeat: {
      surface: "hatClosed",
      bars: [
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
      ],
    },
    fills: [
      { name: "Quarter-Tom Drop", style: "quarter-tom" },
      { name: "Snare Roll Exit", style: "snare-roll" },
    ],
  },
  {
    name: "Powerviolence Chop",
    bpm: 265,
    surface: "ride",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.78,
    blastStyle: "bomb",
    introName: "Stop-Start Setup",
    introStyle: "stop-start",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], bellBeats: [3.5] },
      ],
    },
    backbeat: {
      surface: "ride",
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 3.5], snares: [1, 3] },
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3], crashBeats: [2] },
      ],
    },
    fills: [
      { name: "Choke Turnaround", style: "choke-turnaround" },
      { name: "Floor Slam Fill", style: "floor-slam" },
    ],
  },
  {
    name: "Grind Throttle",
    bpm: 280,
    surface: "ride",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.78,
    blastStyle: "grind",
    introName: "Blast Pickup",
    introStyle: "blast-pickup",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], bellBeats: [3.5] },
      ],
    },
    backbeat: {
      surface: "ride",
      bars: [
        { kicks: [0, 0.5, 1.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 3.5], snares: [1, 3], bellBeats: [3.5] },
      ],
    },
    fills: [
      { name: "High-Speed Tom Run", style: "speed-tom" },
      { name: "Snare Drag Exit", style: "snare-drag" },
    ],
  },
  {
    name: "Two-Step Knife",
    bpm: 205,
    surface: "hatClosed",
    mainPulseStep: 0.5,
    surfaceVelocity: 0.78,
    blastStyle: "skate",
    introName: "Two-Step Count",
    introStyle: "two-step-count",
    mainA: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 2, 2.5, 3.5], snares: [1, 3] },
      ],
    },
    mainB: {
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 1.5, 2, 2.5, 3.5], snares: [1, 3], openHatBeats: [3.5] },
      ],
    },
    backbeat: {
      surface: "hatClosed",
      bars: [
        { kicks: [0, 0.5, 2, 2.5], snares: [1, 3] },
        { kicks: [0, 0.5, 2, 3.5], snares: [1, 3], openHatBeats: [3.5] },
      ],
    },
    fills: [
      { name: "Two-Step Tom Walk", style: "two-step-tom" },
      { name: "Two-Step Snare Walk", style: "two-step-snare" },
    ],
  },
];

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanFolderName(value) {
  return value.replace(/^\d+\s*-\s*/, "").trim();
}

function parseTempo(folderName) {
  const label = cleanFolderName(folderName);
  const match = label.match(/(\d+)\s*-\s*(\d+)\s*BPM/i);
  const low = match ? Number(match[1]) : null;
  const high = match ? Number(match[2]) : null;
  return {
    id: slug(label),
    label,
    range: low && high ? [low, high] : null,
    bpm: low && high ? Math.round((low + high) / 2) : null,
    sort: low ?? 0,
  };
}

function tempoFromBpm(bpm) {
  return {
    id: bpm ? `${bpm}-bpm` : "unknown-bpm",
    label: bpm ? `${bpm} BPM` : "Unknown BPM",
    range: bpm ? [bpm, bpm] : null,
    bpm,
    sort: bpm ?? 0,
  };
}

function groovyDrummerCategorySort(categoryName) {
  return groovyDrummerCategoryOrder.get(categoryName) ?? 99;
}

function note(noteName, beat, velocity = 0.85, duration = 0.12) {
  return {
    note: drumNotes[noteName],
    beat,
    velocity,
    duration,
  };
}

function addPulse(events, startBeat, beats, step, noteName, accentEvery = 4, baseVelocity = 0.62) {
  const steps = Math.round(beats / step);
  for (let index = 0; index < steps; index += 1) {
    const velocity = index % accentEvery === 0 ? Math.min(0.92, baseVelocity + 0.18) : baseVelocity;
    events.push(note(noteName, startBeat + index * step, velocity, step));
  }
}

function addCrash(events, beat, right = false, velocity = 0.94) {
  events.push(note(right ? "crashRight" : "crashLeft", beat, velocity, 0.5));
}

function addBarGroove(events, barStart, pattern, surfaceNote, options = {}) {
  const pulseStep = options.pulseStep ?? 0.25;
  const pulseVelocity = options.pulseVelocity ?? (surfaceNote === "ride" ? 0.56 : 0.62);
  addPulse(events, barStart, 4, pulseStep, surfaceNote, pulseStep === 0.25 ? 4 : 2, pulseVelocity);

  for (const kickBeat of pattern.kicks ?? []) {
    events.push(note("kick", barStart + kickBeat, kickBeat % 1 === 0 ? 0.98 : 0.86, 0.14));
  }
  for (const snareBeat of pattern.snares ?? []) {
    events.push(note("snare", barStart + snareBeat, snareBeat % 1 === 0 ? 0.96 : 0.88, 0.14));
  }

  for (const openHatBeat of pattern.openHatBeats ?? []) {
    events.push(note("hatOpen", barStart + openHatBeat, 0.68, 0.28));
  }
  for (const bellBeat of pattern.bellBeats ?? []) {
    events.push(note("rideBell", barStart + bellBeat, 0.82, 0.18));
  }
  for (const crashRideBeat of pattern.crashRideBeats ?? []) {
    events.push(note("rideCrash", barStart + crashRideBeat, 0.9, 0.45));
  }
  for (const crashBeat of pattern.crashBeats ?? []) {
    addCrash(events, barStart + crashBeat, crashBeat >= 2, 0.9);
  }
}

function buildMainGroove(family, variant) {
  const events = [];
  const section = variant === "A" ? family.mainA : family.mainB;
  const alternateSurface = variant === "B" && family.surface === "hatClosed" ? "ride" : family.surface;

  for (let bar = 0; bar < 2; bar += 1) {
    const barStart = bar * 4;
    addBarGroove(events, barStart, barPattern(section, bar), alternateSurface, {
      pulseStep: family.mainPulseStep,
      pulseVelocity: family.surfaceVelocity,
    });
    if (bar === 0) {
      addCrash(events, barStart, false, 0.94);
    }
  }

  return events;
}

function buildBackbeat(family) {
  const events = [];
  for (let bar = 0; bar < 2; bar += 1) {
    addBarGroove(events, bar * 4, barPattern(family.backbeat, bar), family.backbeat.surface ?? family.surface, {
      pulseStep: family.backbeat.pulseStep ?? 0.5,
      pulseVelocity: family.backbeat.surfaceVelocity ?? family.surfaceVelocity,
    });
  }
  addCrash(events, 0, false, 0.92);
  return events;
}

function buildBlast(family) {
  const events = [];
  const surface = family.blastSurface ?? family.surface;

  for (let bar = 0; bar < 2; bar += 1) {
    const barStart = bar * 4;
    addCrash(events, barStart, bar === 1, 0.9);
    addPulse(events, barStart, 4, 0.25, surface, 4, ["ride", "rideCrash"].includes(surface) ? 0.76 : 0.82);

    for (let step = 0; step < 16; step += 1) {
      const beat = barStart + step * 0.25;
      if (family.blastStyle === "bomb") {
        if (step % 2 === 0) {
          events.push(note("kick", beat, 0.92, 0.12));
          events.push(note("snare", beat, 0.9, 0.12));
        } else if (step % 4 === 1) {
          events.push(note("kick", beat, 0.76, 0.1));
        }
      } else if (family.blastStyle === "hammer") {
        if (step % 4 === 0) {
          events.push(note("kick", beat, 0.94, 0.12));
        } else if (step % 4 === 2) {
          events.push(note("snare", beat, 0.92, 0.12));
        } else if (step % 4 === 1) {
          events.push(note("kick", beat, 0.76, 0.1));
        } else {
          events.push(note("snare", beat, 0.76, 0.1));
        }
      } else if (family.blastStyle === "skank") {
        if (step % 4 === 0) {
          events.push(note("kick", beat, 0.94, 0.12));
        } else if (step % 4 === 2) {
          events.push(note("snare", beat, 0.92, 0.12));
        } else if (step % 4 === 3) {
          events.push(note("kick", beat, 0.7, 0.1));
        }
      } else if (family.blastStyle === "dbeat") {
        if (step % 4 === 0) {
          events.push(note("kick", beat, 0.94, 0.12));
        }
        if (step % 4 === 2) {
          events.push(note("snare", beat, 0.92, 0.12));
        }
        if (step % 8 === 6) {
          events.push(note("kick", beat, 0.78, 0.1));
        }
      } else if (family.blastStyle === "dbeat-open") {
        if (step % 4 === 0) {
          events.push(note("kick", beat, 0.94, 0.12));
        }
        if (step % 4 === 2) {
          events.push(note("snare", beat, 0.92, 0.12));
        }
        if (step % 8 === 6) {
          events.push(note("kick", beat, 0.78, 0.1));
        }
        if (step % 16 === 14) {
          events.push(note("snare", beat, 0.74, 0.1));
        }
      } else if (family.blastStyle === "grind") {
        if (step % 2 === 0) {
          events.push(note("kick", beat, step % 4 === 0 ? 0.95 : 0.84, 0.1));
        } else {
          events.push(note("snare", beat, 0.86, 0.1));
        }
        if (step % 8 === 4) {
          events.push(note("snare", beat, 0.92, 0.1));
        }
      } else if (family.blastStyle === "skate") {
        if (step % 4 === 0) {
          events.push(note("kick", beat, 0.94, 0.12));
        } else if (step % 4 === 2) {
          events.push(note("snare", beat, 0.92, 0.12));
        }
        if (step % 8 === 7) {
          events.push(note("snare", beat, 0.72, 0.09));
        }
      } else if (family.blastStyle === "hardcore") {
        if (step % 4 === 0) {
          events.push(note("kick", beat, 0.94, 0.12));
        } else if (step % 4 === 2) {
          events.push(note("snare", beat, 0.92, 0.12));
        }
        if (step % 8 === 3) {
          events.push(note("kick", beat, 0.76, 0.1));
        }
        if (step % 8 === 6) {
          events.push(note("kick", beat, 0.82, 0.1));
        }
      } else {
        events.push(note(step % 2 === 0 ? "kick" : "snare", beat, step % 4 === 0 ? 0.94 : 0.84, 0.1));
      }
    }
  }

  return events;
}

function buildFill(fill) {
  const events = [];
  const addSequence = (startBeat, step, drums, velocity = 0.84) => {
    drums.forEach((drum, index) => {
      events.push(note(drum, startBeat + index * step, index % 4 === 0 ? Math.min(0.96, velocity + 0.1) : velocity, 0.14));
    });
  };

  if (fill.style === "floor-turnaround") {
    events.push(note("kick", 0, 0.94));
    events.push(note("snare", 1, 0.88));
    addSequence(2, 0.25, ["rackTom", "rackTom", "floorTom", "floorTom", "lowFloorTom", "floorTom", "snare", "floorTom"], 0.8);
  } else if (fill.style === "snare-push") {
    addSequence(0, 0.25, ["snare", "snare", "snare", "snare", "kick", "snare", "kick", "snare", "rackTom", "snare", "floorTom", "snare", "floorTom", "floorTom", "snare", "snare"], 0.78);
  } else if (fill.style === "rack-floor") {
    events.push(note("kick", 0, 0.95));
    addSequence(1, 0.25, ["snare", "snare", "rackTom", "rackTom", "rackTom", "floorTom", "floorTom", "floorTom", "snare", "floorTom", "snare", "floorTom"], 0.82);
  } else if (fill.style === "crash-stop") {
    addCrash(events, 0, false, 0.92);
    events.push(note("kick", 0, 0.96));
    events.push(note("snare", 1, 0.9));
    events.push(note("kick", 2, 0.94));
    addCrash(events, 2, true, 0.92);
    addSequence(3, 0.25, ["snare", "snare", "floorTom", "floorTom"], 0.82);
  } else if (fill.style === "quarter-tom") {
    addSequence(0, 0.5, ["snare", "rackTom", "floorTom", "lowFloorTom", "snare", "rackTom", "floorTom", "lowFloorTom"], 0.9);
  } else if (fill.style === "snare-roll") {
    addSequence(0, 0.25, ["snare", "snare", "kick", "snare", "snare", "snare", "rackTom", "snare", "snare", "snare", "floorTom", "snare", "rackTom", "floorTom", "floorTom", "snare"], 0.76);
  } else if (fill.style === "choke-turnaround") {
    addCrash(events, 0, false, 0.9);
    events.push(note("kick", 0, 0.95));
    addSequence(1, 0.5, ["snare", "floorTom", "snare", "floorTom"], 0.86);
    addSequence(3, 0.25, ["snare", "snare", "floorTom", "floorTom"], 0.8);
  } else if (fill.style === "floor-slam") {
    addSequence(0, 0.25, ["floorTom", "kick", "floorTom", "snare", "floorTom", "kick", "floorTom", "snare", "rackTom", "rackTom", "floorTom", "floorTom", "lowFloorTom", "floorTom", "snare", "floorTom"], 0.82);
  } else if (fill.style === "speed-tom") {
    addSequence(0, 0.25, ["snare", "rackTom", "snare", "rackTom", "floorTom", "floorTom", "snare", "floorTom", "rackTom", "rackTom", "floorTom", "floorTom", "lowFloorTom", "floorTom", "snare", "floorTom"], 0.8);
  } else if (fill.style === "snare-drag") {
    addSequence(0, 0.25, ["snare", "snare", "snare", "kick", "snare", "snare", "snare", "kick", "snare", "rackTom", "snare", "floorTom", "snare", "floorTom", "snare", "snare"], 0.78);
  } else if (fill.style === "two-step-tom") {
    events.push(note("kick", 0, 0.95));
    events.push(note("snare", 1, 0.9));
    addSequence(2, 0.25, ["rackTom", "snare", "rackTom", "floorTom", "floorTom", "snare", "floorTom", "lowFloorTom"], 0.78);
  } else if (fill.style === "open-hat-turnaround") {
    events.push(note("hatOpen", 0, 0.84, 0.35));
    events.push(note("kick", 0, 0.95));
    events.push(note("snare", 1, 0.9));
    events.push(note("hatOpen", 2, 0.82, 0.35));
    addSequence(2, 0.25, ["rackTom", "snare", "floorTom", "snare", "floorTom", "kick", "snare", "floorTom"], 0.78);
  } else if (fill.style === "dbeat-snare-walk") {
    events.push(note("hatOpen", 0, 0.82, 0.35));
    addSequence(0, 0.25, ["snare", "kick", "snare", "snare", "snare", "kick", "rackTom", "snare", "floorTom", "snare", "floorTom", "kick", "snare", "floorTom", "snare", "floorTom"], 0.78);
  } else if (fill.style === "mosh-tom-walk") {
    events.push(note("rideCrash", 0, 0.88, 0.45));
    events.push(note("kick", 0, 0.96));
    events.push(note("snare", 1, 0.9));
    addSequence(2, 0.25, ["floorTom", "kick", "floorTom", "snare", "rackTom", "floorTom", "snare", "floorTom"], 0.82);
  } else if (fill.style === "hardcore-stop") {
    events.push(note("rideCrash", 0, 0.9, 0.45));
    events.push(note("kick", 0, 0.96));
    events.push(note("snare", 1, 0.9));
    events.push(note("kick", 2, 0.94));
    events.push(note("rideCrash", 2, 0.88, 0.45));
    addSequence(3, 0.25, ["snare", "snare", "floorTom", "floorTom"], 0.84);
  } else {
    addSequence(0, 0.25, ["snare", "kick", "snare", "snare", "snare", "kick", "rackTom", "snare", "floorTom", "snare", "floorTom", "kick", "snare", "floorTom", "snare", "floorTom"], 0.78);
  }

  addCrash(events, 3.75, true, 0.94);
  return events;
}

function buildIntro(family) {
  const events = [];
  const hitsByStyle = {
    "crash-count": [
      ["crashLeft", 0, 0.94],
      ["kick", 0, 0.96],
      ["snare", 1, 0.88],
      ["kick", 2, 0.94],
      ["snare", 3, 0.92],
      ["snare", 3.5, 0.82],
      ["snare", 3.75, 0.94],
    ],
    "dbeat-pickup": [
      ["crashLeft", 0, 0.92],
      ["kick", 0, 0.95],
      ["snare", 1, 0.88],
      ["kick", 1.5, 0.86],
      ["floorTom", 2.5, 0.84],
      ["snare", 3, 0.9],
      ["floorTom", 3.5, 0.86],
      ["snare", 3.75, 0.92],
    ],
    "fastcore-chokes": [
      ["crashLeft", 0, 0.92],
      ["kick", 0, 0.96],
      ["snare", 1, 0.9],
      ["crashRight", 2, 0.9],
      ["kick", 2, 0.94],
      ["snare", 3, 0.82],
      ["snare", 3.25, 0.76],
      ["snare", 3.5, 0.84],
      ["snare", 3.75, 0.94],
    ],
    "stop-start": [
      ["crashLeft", 0, 0.94],
      ["kick", 0, 0.96],
      ["snare", 1, 0.9],
      ["kick", 2, 0.94],
      ["floorTom", 2.5, 0.84],
      ["snare", 3.5, 0.86],
      ["snare", 3.75, 0.94],
    ],
    "blast-pickup": [
      ["crashLeft", 0, 0.94],
      ["kick", 0, 0.96],
      ["snare", 1, 0.9],
      ["kick", 2, 0.9],
      ["snare", 2.5, 0.84],
      ["kick", 3, 0.88],
      ["snare", 3.25, 0.8],
      ["kick", 3.5, 0.84],
      ["snare", 3.75, 0.94],
    ],
    "two-step-count": [
      ["crashLeft", 0, 0.92],
      ["kick", 0, 0.96],
      ["snare", 1, 0.9],
      ["kick", 2, 0.94],
      ["snare", 3, 0.9],
      ["floorTom", 3.5, 0.84],
      ["snare", 3.75, 0.92],
    ],
    "open-hat-count": [
      ["crashLeft", 0, 0.92],
      ["hatOpen", 0, 0.84],
      ["kick", 0, 0.96],
      ["snare", 1, 0.9],
      ["hatOpen", 1.5, 0.78],
      ["kick", 2, 0.94],
      ["snare", 3, 0.9],
      ["hatOpen", 3.5, 0.8],
      ["snare", 3.75, 0.92],
    ],
    "mosh-pickup": [
      ["rideCrash", 0, 0.9],
      ["kick", 0, 0.96],
      ["snare", 1, 0.9],
      ["kick", 1.5, 0.86],
      ["rideCrash", 2, 0.88],
      ["kick", 2, 0.94],
      ["floorTom", 3, 0.86],
      ["snare", 3.5, 0.86],
      ["snare", 3.75, 0.94],
    ],
  };

  for (const [drum, beat, velocity] of hitsByStyle[family.introStyle] ?? hitsByStyle["crash-count"]) {
    events.push(note(drum, beat, velocity, drum.startsWith("crash") || drum === "rideCrash" ? 0.5 : 0.14));
  }

  events.push(note("hatOpen", 3.5, 0.68, 0.25));
  return events;
}

function barPattern(section, bar) {
  return section.bars[bar % section.bars.length];
}

function buildGroovyDrummerBeatDefinitions() {
  const definitions = [];

  for (const family of groovyDrummerFamilies) {
    definitions.push({
      family: family.name,
      categoryName: "Intros / Stops",
      name: `${family.name} - ${family.introName}`,
      bpm: family.bpm,
      bars: 1,
      events: buildIntro(family),
    });
    definitions.push({
      family: family.name,
      categoryName: "Main Grooves",
      name: `${family.name} - Main A`,
      bpm: family.bpm,
      bars: 2,
      events: buildMainGroove(family, "A"),
    });
    definitions.push({
      family: family.name,
      categoryName: "Main Grooves",
      name: `${family.name} - Main B`,
      bpm: family.bpm,
      bars: 2,
      events: buildMainGroove(family, "B"),
    });
    definitions.push({
      family: family.name,
      categoryName: "Backbeats",
      name: `${family.name} - Backbeat`,
      bpm: family.bpm,
      bars: 2,
      events: buildBackbeat(family),
    });
    definitions.push({
      family: family.name,
      categoryName: "Blast Beats",
      name: `${family.name} - Blast`,
      bpm: family.bpm,
      bars: 2,
      events: buildBlast(family),
    });
    for (const fill of family.fills) {
      definitions.push({
        family: family.name,
        categoryName: "Fills",
        name: `${family.name} - ${fill.name}`,
        bpm: family.bpm,
        bars: 1,
        events: buildFill(fill),
      });
    }
  }

  return definitions;
}

function parseArchiveTempo(parts, fileName) {
  const text = [...parts, fileName].join(" ");
  const bpmMatch = [...text.matchAll(/(?:^|[^0-9])(\d{2,3})\s*bpm\b/gi)]
    .map((match) => Number(match[1]))
    .find((value) => value >= 40 && value <= 320);

  if (bpmMatch) {
    return tempoFromBpm(bpmMatch);
  }

  const baseName = path.basename(fileName, path.extname(fileName));
  const leadingTempo = Number(baseName.match(/^(\d{2,3})(?=\D)/)?.[1] ?? 0);
  return tempoFromBpm(leadingTempo >= 40 && leadingTempo <= 320 ? leadingTempo : null);
}

function prettyArchiveSegment(value) {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\.(sng|prt|lib)$/i, "")
    .replace(/^\d+@/, "")
    .replace(/^\d+\s*-\s*/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTempo(value) {
  const pretty = prettyArchiveSegment(value);
  return pretty.replace(/\b\d{2,3}\s*bpm\b/gi, "").replace(/\s+/g, " ").trim() || pretty;
}

const archiveCategoryOrder = new Map([
  ["Backbeats", 1],
  ["Grooves", 2],
  ["Fills", 3],
  ["Intros / Endings", 4],
]);

function archiveCategorySort(categoryName) {
  return archiveCategoryOrder.get(categoryName) ?? 99;
}

function archivePartCategory(parts, fileName) {
  const text = [...parts.map(stripTempo), prettyArchiveSegment(fileName)]
    .join(" ")
    .toLowerCase();

  if (/\bback\s*beat\b/.test(text) || /\bbackbeat\b/.test(text)) {
    return "Backbeats";
  }
  if (/\bfill(?:s)?\b/.test(text) && !/\bno\s+fill\b/.test(text)) {
    return "Fills";
  }
  if (/\bintro\b|\boutro\b|\bend(?:ing)?\b|\bcount(?:s)?\b|\bhit(?:s)?\b/.test(text)) {
    return "Intros / Endings";
  }
  if (/\bgroove(?:s)?\b|\bsong\s*loop(?:s)?\b|\bsingle\s*track\b|\bmulti[-\s]*track\b|\btype\s*0\b|\bpunk\s*rock\b|\bstraight\b|\bclassic\s*beats\b|\bbonus\b|\bpreview\s*file(?:s)?\b/.test(text)) {
    return "Grooves";
  }
  return "Grooves";
}

const terminusCategoryOrder = new Map([
  ["Grooves", 1],
  ["Blasts", 2],
  ["Fills", 3],
  ["Song Parts", 4],
]);

function terminusCategorySort(categoryName) {
  return terminusCategoryOrder.get(categoryName) ?? 99;
}

function isTerminusFill(fileName) {
  return /_F_/i.test(fileName);
}

function terminusCategory(parts, fileName) {
  const text = [...parts, fileName].join(" ").replace(/[_-]+/g, " ").toLowerCase();

  if (parts.some((part) => /^song\s+\d+/i.test(part))) {
    return "Song Parts";
  }
  if (/\bblast\b/.test(text)) {
    return "Blasts";
  }
  if (isTerminusFill(fileName) || /\bfill(?:s)?\b/.test(text)) {
    return "Fills";
  }
  return "Grooves";
}

function prettyTerminusName(fileName) {
  const isFill = isTerminusFill(fileName);
  let name = path.basename(fileName, path.extname(fileName))
    .replace(/^Metal_V_\s*/i, "")
    .replace(/_C_Terminus(?:_F_)?$/i, "")
    .replace(/_F_$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isFill && !/\bfill\b/i.test(name)) {
    name = `${name} Fill`;
  }

  return name;
}

function terminusGrooveNumber(grooveName) {
  return Number(
    grooveName.match(/\bGroove\s*(\d+)/i)?.[1] ??
    grooveName.match(/\bBlast\s*(\d+)/i)?.[1] ??
    grooveName.match(/\bG(\d+)/i)?.[1] ??
    grooveName.match(/(\d+)/)?.[1] ??
    0,
  );
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseMeter(value) {
  const match = value.match(/(?:^|\D)(\d+)[-_](\d+)(?:\D|$)/);
  return match ? `${match[1]}/${match[2]}` : null;
}

async function listMidiFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMidiFiles(fullPath)));
    } else if (/\.(mid|midi)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function listArchivePunkMidiFiles(archiveDir) {
  const { stdout } = await execFileAsync("find", [
    archiveDir,
    "-type",
    "f",
    "(",
    "-iname",
    "*.mid",
    "-o",
    "-iname",
    "*.midi",
    ")",
    "-ipath",
    "*punk*",
  ], { maxBuffer: 64 * 1024 * 1024 });

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function makePattern(notes, duration, groups = gmGroups) {
  const bins = 32;
  const lanes = Object.fromEntries(patternGroups.map((group) => [group, Array(bins).fill(0)]));
  const safeDuration = Math.max(duration, 0.25);

  for (const note of notes) {
    const group = groups.get(note.midi);
    if (!group) {
      continue;
    }
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((note.time / safeDuration) * bins)));
    lanes[group][bin] = Math.min(1, Math.max(lanes[group][bin], note.velocity || 0.65));
  }

  return lanes;
}

function summarizeHits(notes, groups = gmGroups) {
  const counts = Object.fromEntries(patternGroups.map((group) => [group, 0]));
  const usedNotes = new Set();

  for (const note of notes) {
    const group = groups.get(note.midi);
    if (!group) {
      continue;
    }
    counts[group] += 1;
    usedNotes.add(note.midi);
  }

  return {
    counts,
    notes: [...usedNotes].sort((a, b) => a - b),
  };
}

function midiBytesForGroovyDrummerBeat(definition) {
  const midi = new Midi();
  midi.header.setTempo(definition.bpm);

  const track = midi.addTrack();
  track.channel = 9;
  track.name = definition.name;

  const beatSeconds = 60 / definition.bpm;
  const totalBeats = definition.bars * 4;
  const lastBeat = Math.max(...definition.events.map((event) => event.beat));
  const mergedEvents = mergeDrumEvents(definition.events);

  for (const event of mergedEvents) {
    const reachesEnd = Math.abs(event.beat - lastBeat) < 0.0001;
    const durationBeats = reachesEnd
      ? Math.max(0.01, totalBeats - event.beat)
      : event.duration;

    track.addNote({
      midi: event.note,
      time: event.beat * beatSeconds,
      duration: Math.max(0.01, durationBeats * beatSeconds),
      velocity: Math.max(0.02, Math.min(1, event.velocity)),
    });
  }

  return midi.toArray();
}

function mergeDrumEvents(events) {
  const merged = new Map();

  for (const event of events) {
    const key = `${event.note}:${event.beat.toFixed(4)}`;
    const current = merged.get(key);

    if (!current || event.velocity > current.velocity) {
      merged.set(key, { ...event });
    }
  }

  return [...merged.values()].sort((a, b) => a.beat - b.beat || a.note - b.note);
}

async function addGroovyDrummerGrooves(grooves, packNames) {
  packNames.set(groovyDrummerPackId, groovyDrummerPackName);

  const definitions = buildGroovyDrummerBeatDefinitions();

  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const tempo = tempoFromBpm(definition.bpm);
    const categorySort = groovyDrummerCategorySort(definition.categoryName);
    const categoryId = slug(definition.categoryName);
    const grooveName = definition.name;
    const destinationPath = path.join(
      midiOutDir,
      groovyDrummerPackId,
      categoryId,
      tempo.id,
      `${slug(grooveName)}.mid`,
    );
    const assetPath = path.relative(publicDir, destinationPath).split(path.sep).join("/");
    const midiBytes = midiBytesForGroovyDrummerBeat(definition);

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, midiBytes);

    const midi = new Midi(midiBytes);
    const notes = midi.tracks.flatMap((track) => track.notes);
    const duration = midi.duration || notes.reduce((max, midiNote) => Math.max(max, midiNote.time + midiNote.duration), 0);
    const hits = summarizeHits(notes);

    grooves.push({
      id: `${groovyDrummerPackId}/${categoryId}/${tempo.id}/${slug(grooveName)}`,
      packId: groovyDrummerPackId,
      packName: groovyDrummerPackName,
      midiMap: "gm",
      tempoId: tempo.id,
      tempoLabel: tempo.label,
      tempoRange: tempo.range,
      tempoSort: tempo.sort,
      bpm: tempo.bpm,
      categoryId,
      categoryName: definition.categoryName,
      categorySort,
      grooveName,
      grooveNumber: index + 1,
      meter: "4/4",
      sourcePath: [
        "GroovyDrummer Originals",
        definition.family,
        definition.categoryName,
        `${grooveName}.mid`,
      ].join("/"),
      assetPath,
      size: midiBytes.byteLength,
      duration: Number(duration.toFixed(3)),
      noteCount: notes.length,
      hitCounts: hits.counts,
      usedNotes: hits.notes,
      pattern: makePattern(notes, duration),
    });
  }
}

async function main() {
  const rootEntries = await readdir(rootDir, { withFileTypes: true });
  const packDirs = rootEntries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("(JJ Groove Packs)"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (!packDirs.length) {
    throw new Error("No JJ Groove Pack directories found.");
  }

  await rm(midiOutDir, { recursive: true, force: true });
  await mkdir(midiOutDir, { recursive: true });

  const grooves = [];
  const packNames = new Map();

  await addGroovyDrummerGrooves(grooves, packNames);

  for (const packDirName of packDirs) {
    const packName = packDirName.replace(/\s*\(JJ Groove Packs\)$/, "");
    const packId = slug(packName);
    packNames.set(packId, packName);
    const packDir = path.join(rootDir, packDirName);
    const midiFiles = await listMidiFiles(packDir);

    for (const midiPath of midiFiles) {
      const relativeSourcePath = path.relative(rootDir, midiPath);
      const relativeParts = path.relative(packDir, midiPath).split(path.sep);

      if (relativeParts.length < 3) {
        continue;
      }

      const [tempoFolder, categoryFolder, fileName] = relativeParts;
      const tempo = parseTempo(tempoFolder);
      const categoryName = cleanFolderName(categoryFolder);
      const categorySort = Number(categoryFolder.match(/^(\d+)/)?.[1] ?? 0);
      const categoryId = slug(categoryName);
      const grooveName = path.basename(fileName, path.extname(fileName));
      const grooveNumber = Number(grooveName.match(/Groove\s*(\d+)/i)?.[1] ?? grooveName.match(/(\d+)/)?.[1] ?? 0);
      const meterMatch = grooveName.match(/^(\d+)-(\d+)\s*-/);
      const destinationPath = path.join(midiOutDir, packId, tempo.id, categoryId, `${slug(grooveName)}.mid`);
      const assetPath = path.relative(publicDir, destinationPath).split(path.sep).join("/");

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(midiPath, destinationPath);

      const [bytes, buffer] = await Promise.all([stat(midiPath), readFile(midiPath)]);
      const midi = new Midi(buffer);
      const notes = midi.tracks.flatMap((track) => track.notes);
      const duration = midi.duration || notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
      const hits = summarizeHits(notes);

      grooves.push({
        id: `${packId}/${tempo.id}/${categoryId}/${slug(grooveName)}`,
        packId,
        packName,
        midiMap: "gm",
        tempoId: tempo.id,
        tempoLabel: tempo.label,
        tempoRange: tempo.range,
        tempoSort: tempo.sort,
        bpm: tempo.bpm,
        categoryId,
        categoryName,
        categorySort,
        grooveName,
        grooveNumber,
        meter: meterMatch ? `${meterMatch[1]}/${meterMatch[2]}` : null,
        sourcePath: relativeSourcePath.split(path.sep).join("/"),
        assetPath,
        size: bytes.size,
        duration: Number(duration.toFixed(3)),
        noteCount: notes.length,
        hitCounts: hits.counts,
        usedNotes: hits.notes,
        pattern: makePattern(notes, duration),
      });
    }
  }

  const archiveDir = path.join(rootDir, archiveDirName);
  try {
    await stat(archiveDir);
    const packId = "punk-archive";
    const packName = "Punk Archive";
    const midiFiles = await listArchivePunkMidiFiles(archiveDir);
    packNames.set(packId, packName);

    for (const midiPath of midiFiles) {
      const relativeSourcePath = path.relative(rootDir, midiPath);
      const relativeParts = path.relative(archiveDir, midiPath).split(path.sep);
      const fileName = relativeParts.at(-1);
      const dirParts = relativeParts.slice(0, -1);

      if (!fileName || !dirParts.length) {
        continue;
      }

      const tempo = parseArchiveTempo(dirParts, fileName);
      const categoryName = archivePartCategory(dirParts, fileName);
      const categorySort = 1000 + archiveCategorySort(categoryName);
      const categoryId = slug(categoryName);
      const grooveName = prettyArchiveSegment(path.basename(fileName, path.extname(fileName)));
      const grooveNumber = Number(grooveName.match(/^(\d+)/)?.[1] ?? grooveName.match(/(\d+)/)?.[1] ?? 0);
      const sourceHash = stableHash(relativeSourcePath);
      const destinationPath = path.join(
        midiOutDir,
        packId,
        categoryId,
        tempo.id,
        `${slug(grooveName)}-${sourceHash}.mid`,
      );
      const assetPath = path.relative(publicDir, destinationPath).split(path.sep).join("/");

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(midiPath, destinationPath);

      const [bytes, buffer] = await Promise.all([stat(midiPath), readFile(midiPath)]);
      const midi = new Midi(buffer);
      const notes = midi.tracks.flatMap((track) => track.notes);
      const duration = midi.duration || notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
      const hits = summarizeHits(notes);

      grooves.push({
        id: `${packId}/${categoryId}/${tempo.id}/${slug(grooveName)}-${sourceHash}`,
        packId,
        packName,
        midiMap: "gm",
        tempoId: tempo.id,
        tempoLabel: tempo.label,
        tempoRange: tempo.range,
        tempoSort: tempo.sort,
        bpm: tempo.bpm,
        categoryId,
        categoryName,
        categorySort,
        grooveName,
        grooveNumber,
        meter: parseMeter(`${dirParts.join(" ")} ${grooveName}`),
        sourcePath: relativeSourcePath.split(path.sep).join("/"),
        assetPath,
        size: bytes.size,
        duration: Number(duration.toFixed(3)),
        noteCount: notes.length,
        hitCounts: hits.counts,
        usedNotes: hits.notes,
        pattern: makePattern(notes, duration),
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const terminusDir = path.join(rootDir, terminusDirName);
  try {
    await stat(terminusDir);
    const packId = "terminus-metal";
    const packName = "Terminus Metal";
    const midiFiles = await listMidiFiles(terminusDir);
    packNames.set(packId, packName);

    for (const midiPath of midiFiles) {
      const relativeSourcePath = path.relative(rootDir, midiPath);
      const relativeParts = path.relative(terminusDir, midiPath).split(path.sep);
      const fileName = relativeParts.at(-1);
      const dirParts = relativeParts.slice(0, -1);

      if (!fileName) {
        continue;
      }

      const [bytes, buffer] = await Promise.all([stat(midiPath), readFile(midiPath)]);
      const midi = new Midi(buffer);
      const notes = midi.tracks.flatMap((track) => track.notes);
      const duration = midi.duration || notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
      const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 0) || null;
      const tempo = tempoFromBpm(bpm);
      const categoryName = terminusCategory(dirParts, fileName);
      const categorySort = terminusCategorySort(categoryName);
      const categoryId = slug(categoryName);
      const grooveName = prettyTerminusName(fileName);
      const grooveNumber = terminusGrooveNumber(grooveName);
      const sourceHash = stableHash(relativeSourcePath);
      const destinationPath = path.join(
        midiOutDir,
        packId,
        categoryId,
        tempo.id,
        `${slug(grooveName)}-${sourceHash}.mid`,
      );
      const assetPath = path.relative(publicDir, destinationPath).split(path.sep).join("/");
      const hits = summarizeHits(notes, addictiveDrumsGroups);

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(midiPath, destinationPath);

      grooves.push({
        id: `${packId}/${categoryId}/${tempo.id}/${slug(grooveName)}-${sourceHash}`,
        packId,
        packName,
        midiMap: "addictive-drums",
        tempoId: tempo.id,
        tempoLabel: tempo.label,
        tempoRange: tempo.range,
        tempoSort: tempo.sort,
        bpm: tempo.bpm,
        categoryId,
        categoryName,
        categorySort,
        grooveName,
        grooveNumber,
        meter: parseMeter(`${dirParts.join(" ")} ${grooveName}`),
        sourcePath: relativeSourcePath.split(path.sep).join("/"),
        assetPath,
        size: bytes.size,
        duration: Number(duration.toFixed(3)),
        noteCount: notes.length,
        hitCounts: hits.counts,
        usedNotes: hits.notes,
        pattern: makePattern(notes, duration, addictiveDrumsGroups),
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  grooves.sort((a, b) =>
    a.packName.localeCompare(b.packName) ||
    (b.tempoRange?.[0] ?? 0) - (a.tempoRange?.[0] ?? 0) ||
    a.categorySort - b.categorySort ||
    a.grooveNumber - b.grooveNumber ||
    a.grooveName.localeCompare(b.grooveName),
  );

  const packs = [...packNames.entries()].map(([packId, packName]) => {
    const packGrooves = grooves.filter((groove) => groove.packId === packId);
    const tempos = [...new Map(packGrooves.map((groove) => [groove.tempoId, {
      id: groove.tempoId,
      label: groove.tempoLabel,
      range: groove.tempoRange,
      bpm: groove.bpm,
      count: packGrooves.filter((item) => item.tempoId === groove.tempoId).length,
    }])).values()].sort((a, b) => (b.range?.[0] ?? 0) - (a.range?.[0] ?? 0));
    const categories = [...new Map(packGrooves.map((groove) => [groove.categoryId, {
      id: groove.categoryId,
      name: groove.categoryName,
      sort: groove.categorySort,
      count: packGrooves.filter((item) => item.categoryId === groove.categoryId).length,
    }])).values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

    return {
      id: packId,
      name: packName,
      count: packGrooves.length,
      tempos,
      categories,
    };
  });

  await writeFile(catalogPath, `${JSON.stringify({
    appName: "GroovyDrummer",
    generatedAt: new Date().toISOString(),
    totalGrooves: grooves.length,
    gmMap,
    packs,
    grooves,
  }, null, 2)}\n`);

  console.log(`Generated ${grooves.length} grooves in ${path.relative(rootDir, catalogPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
