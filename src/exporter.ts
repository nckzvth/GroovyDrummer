import JSZip from "jszip";
import { releaseAudioRendererResources, renderGrooveStems, renderGrooveWavBlob } from "./audioRenderer";
import { assetUrl } from "./midi";
import type { AudioExportKind, Groove } from "./types";

type WritableLike = {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
};

type FileHandleLike = {
  createWritable(): Promise<WritableLike>;
};

type DirectoryHandleLike = {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
};

function sanitizeSegment(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function canSaveToDirectory() {
  return typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === "function";
}

export function fileNameForGrooveMidi(groove: Groove) {
  return `${sanitizeSegment(groove.packName)} - ${sanitizeSegment(groove.tempoLabel)} - ${sanitizeSegment(groove.categoryName)} - ${sanitizeSegment(groove.grooveName)}.mid`;
}

export function outputPathForGrooveMidi(groove: Groove) {
  return [
    "output",
    sanitizeSegment(groove.packName),
    sanitizeSegment(groove.tempoLabel),
    sanitizeSegment(groove.categoryName),
    fileNameForGrooveMidi(groove),
  ].join("/");
}

export const fileNameForGroove = fileNameForGrooveMidi;
export const outputPathForGroove = outputPathForGrooveMidi;

export async function fetchGrooveBlob(groove: Groove) {
  if (groove.midiData) {
    return new Blob([new Uint8Array(groove.midiData)], { type: "audio/midi" });
  }

  const response = await fetch(assetUrl(groove.assetPath));
  if (!response.ok) {
    throw new Error(`Unable to download ${groove.grooveName}`);
  }

  return response.blob();
}

export async function downloadGrooveMidi(groove: Groove) {
  const blob = await fetchGrooveBlob(groove);
  saveBlob(blob, fileNameForGrooveMidi(groove));
}

export const downloadGroove = downloadGrooveMidi;

export async function exportGroovesAsZip(grooves: Groove[]) {
  const zip = new JSZip();

  for (const groove of grooves) {
    zip.file(outputPathForGrooveMidi(groove), await fetchGrooveBlob(groove));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveBlob(blob, `GroovyDrummer-midi-${dateStamp()}.zip`);
}

export async function exportGrooveMixWav(groove: Groove, tempo: number) {
  try {
    const blob = await renderGrooveWavBlob(groove, tempo, "full-kit");
    saveBlob(blob, mixFileNameForGroove(groove, tempo));
  } finally {
    await releaseAudioRendererResources();
  }
}

export async function exportGrooveStemZip(groove: Groove, tempo: number) {
  try {
    const zip = new JSZip();
    await addStemPackage(zip, groove, tempo);
    const blob = await zip.generateAsync({ type: "blob" });
    saveBlob(blob, `${sanitizeSegment(groove.grooveName)}-${formatTempo(tempo)}bpm-stems.zip`);
  } finally {
    await releaseAudioRendererResources();
  }
}

export async function exportSelectedAudioZip(
  grooves: Groove[],
  kind: AudioExportKind,
  tempoResolver: (groove: Groove) => number,
  onProgress?: (current: number, total: number, groove: Groove) => void,
) {
  if (grooves.length === 1) {
    const groove = grooves[0];
    const tempo = tempoResolver(groove);
    onProgress?.(1, 1, groove);

    if (kind === "midi") {
      await downloadGrooveMidi(groove);
    } else if (kind === "mix-wav") {
      await exportGrooveMixWav(groove, tempo);
    } else {
      await exportGrooveStemZip(groove, tempo);
    }
    return;
  }

  if (kind === "midi") {
    await exportGroovesAsZip(grooves);
    return;
  }

  try {
    const zip = new JSZip();

    for (let index = 0; index < grooves.length; index += 1) {
      const groove = grooves[index];
      const tempo = tempoResolver(groove);
      onProgress?.(index + 1, grooves.length, groove);

      if (kind === "mix-wav") {
        zip.file(outputPathForMix(groove, tempo), await renderGrooveWavBlob(groove, tempo, "full-kit"));
      } else {
        await addStemPackage(zip, groove, tempo);
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    saveBlob(blob, `GroovyDrummer-${kind === "mix-wav" ? "mix-wavs" : "stems"}-${dateStamp()}.zip`);
  } finally {
    await releaseAudioRendererResources();
  }
}

export async function saveGroovesToDirectory(grooves: Groove[]) {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    await exportGroovesAsZip(grooves);
    return;
  }

  const root = await picker({ mode: "readwrite" });
  const outputDir = await root.getDirectoryHandle("output", { create: true });

  for (const groove of grooves) {
      const packDir = await outputDir.getDirectoryHandle(sanitizeSegment(groove.packName), { create: true });
      const tempoDir = await packDir.getDirectoryHandle(sanitizeSegment(groove.tempoLabel), { create: true });
      const categoryDir = await tempoDir.getDirectoryHandle(sanitizeSegment(groove.categoryName), { create: true });
    const fileHandle = await categoryDir.getFileHandle(fileNameForGrooveMidi(groove), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await fetchGrooveBlob(groove));
    await writable.close();
  }
}

function mixFileNameForGroove(groove: Groove, tempo: number) {
  return `${sanitizeSegment(groove.grooveName)} - ${formatTempo(tempo)}BPM - full-kit.wav`;
}

function outputFolderForAudio(groove: Groove) {
  return [
    "output",
    sanitizeSegment(groove.packName),
    sanitizeSegment(groove.tempoLabel),
    sanitizeSegment(groove.categoryName),
    sanitizeSegment(groove.grooveName),
  ].join("/");
}

function outputPathForMix(groove: Groove, tempo: number) {
  return [outputFolderForAudio(groove), mixFileNameForGroove(groove, tempo)].join("/");
}

async function addStemPackage(zip: JSZip, groove: Groove, tempo: number) {
  const folder = outputFolderForAudio(groove);
  const stems = await renderGrooveStems(groove, tempo);

  for (const stem of stems) {
    zip.file([folder, stem.fileName].join("/"), stem.blob);
  }

  zip.file([folder, fileNameForGrooveMidi(groove)].join("/"), await fetchGrooveBlob(groove));
  zip.file([folder, "metadata.json"].join("/"), JSON.stringify({
    appName: "GroovyDrummer",
    grooveId: groove.id,
    packName: groove.packName,
    tempoLabel: groove.tempoLabel,
    categoryName: groove.categoryName,
    grooveName: groove.grooveName,
    renderedTempo: tempo,
    sourcePath: groove.sourcePath,
    stems: stems.map((stem) => stem.fileName),
  }, null, 2));
}

function formatTempo(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
