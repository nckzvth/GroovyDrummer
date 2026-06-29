import JSZip from "jszip";
import type { Groove } from "./types";

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

function assetUrl(assetPath: string) {
  return new URL(assetPath, window.location.href).toString();
}

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

export function fileNameForGroove(groove: Groove) {
  return `${sanitizeSegment(groove.packName)} - ${sanitizeSegment(groove.tempoLabel)} - ${sanitizeSegment(groove.categoryName)} - ${sanitizeSegment(groove.grooveName)}.mid`;
}

export function outputPathForGroove(groove: Groove) {
  return [
    "output",
    sanitizeSegment(groove.packName),
    sanitizeSegment(groove.tempoLabel),
    sanitizeSegment(groove.categoryName),
    fileNameForGroove(groove),
  ].join("/");
}

export async function fetchGrooveBlob(groove: Groove) {
  const response = await fetch(assetUrl(groove.assetPath));
  if (!response.ok) {
    throw new Error(`Unable to download ${groove.grooveName}`);
  }

  return response.blob();
}

export async function downloadGroove(groove: Groove) {
  const blob = await fetchGrooveBlob(groove);
  saveBlob(blob, fileNameForGroove(groove));
}

export async function exportGroovesAsZip(grooves: Groove[]) {
  const zip = new JSZip();

  for (const groove of grooves) {
    zip.file(outputPathForGroove(groove), await fetchGrooveBlob(groove));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveBlob(blob, `GroovyDrummer-output-${dateStamp()}.zip`);
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
    const fileHandle = await categoryDir.getFileHandle(fileNameForGroove(groove), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await fetchGrooveBlob(groove));
    await writable.close();
  }
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
