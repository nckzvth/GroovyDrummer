import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(rootDir, "public", "samples", "home-kit-balanced", "manifest.json"), "utf8"));
const mixSource = await readFile(path.join(rootDir, "src", "homeKitMix.ts"), "utf8");
const mix = parseMixSource(mixSource);
const articulations = ["kick", "snare", "hat-closed", "ride-bow", "crash-left", "crash-right"];
const report = {};
const failures = [];

for (const articulation of articulations) {
  const micPeaks = [];
  const mics = manifest.layers[articulation] ?? {};

  for (const [mic, layers] of Object.entries(mics)) {
    const layer = layers[layers.length - 1];
    const samplePath = path.join(rootDir, "public", "samples", "home-kit-balanced", layer.path);
    const samplePeak = wavPeak(await readFile(samplePath));
    const level = mix.master + mix.mics[mic] + (mix.articulations[articulation] ?? 0);
    const mixedPeak = samplePeak * dbToGain(level);
    micPeaks.push(mixedPeak);
  }

  const estimatedPeak = micPeaks.reduce((sum, value) => sum + value, 0);
  const peakDb = gainToDb(estimatedPeak);
  report[articulation] = Number(peakDb.toFixed(1));

  if (peakDb > -3) {
    failures.push(`${articulation} estimated single-hit peak is too hot at ${peakDb.toFixed(1)} dBFS.`);
  }
}

for (const articulation of ["hat-closed", "ride-bow", "crash-left", "crash-right"]) {
  const floor = articulation === "hat-closed" ? -40 : -36;
  if (report[articulation] < floor) {
    failures.push(`${articulation} estimated peak is too quiet at ${report[articulation]} dBFS.`);
  }
}

if (failures.length) {
  throw new Error(failures.join("\n"));
}

console.log(`Validated Home Kit mix peaks: ${JSON.stringify(report)}`);

function parseMixSource(source) {
  return {
    master: Number(source.match(/homeKitMasterLevel\s*=\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? -6),
    mics: parseObjectBlock(source, "homeKitMicLevels"),
    articulations: parseObjectBlock(source, "homeKitArticulationLevels"),
  };
}

function parseObjectBlock(source, name) {
  const block = source.match(new RegExp(`${name}[^=]*=\\s*\\{([\\s\\S]*?)\\};`))?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/["']?([a-z-]+)["']?\s*:\s*(-?\d+(?:\.\d+)?)/g)]
      .map((match) => [match[1], Number(match[2])]),
  );
}

function wavPeak(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected RIFF/WAVE sample.");
  }

  let offset = 12;
  let format = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(start),
        bitsPerSample: buffer.readUInt16LE(start + 14),
      };
    } else if (id === "data") {
      data = { start, size };
      break;
    }

    offset = start + size + (size % 2);
  }

  if (!format || !data) {
    throw new Error("Invalid WAV sample.");
  }

  const bytesPerSample = format.bitsPerSample / 8;
  let peak = 0;

  for (let index = data.start; index + bytesPerSample <= data.start + data.size; index += bytesPerSample) {
    peak = Math.max(peak, Math.abs(readPcmSample(buffer, index, format)));
  }

  return peak;
}

function readPcmSample(buffer, index, format) {
  if (format.audioFormat === 3 && format.bitsPerSample === 32) {
    return buffer.readFloatLE(index);
  }
  if (format.bitsPerSample === 16) {
    return buffer.readInt16LE(index) / 32768;
  }
  if (format.bitsPerSample === 24) {
    const raw = buffer[index] | (buffer[index + 1] << 8) | (buffer[index + 2] << 16);
    const signed = raw & 0x800000 ? raw | 0xff000000 : raw;
    return signed / 8388608;
  }
  if (format.bitsPerSample === 32) {
    return buffer.readInt32LE(index) / 2147483648;
  }
  throw new Error(`Unsupported WAV bit depth ${format.bitsPerSample}.`);
}

function dbToGain(db) {
  return 10 ** (db / 20);
}

function gainToDb(gain) {
  return 20 * Math.log10(Math.max(gain, 1e-9));
}
