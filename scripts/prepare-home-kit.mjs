import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  homeKitSources,
  layerFileName,
  normalizedFileName,
  publicSampleDir,
  sampleRootDirName,
} from "./home-kit-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, sampleRootDirName);
const outputDir = path.join(rootDir, "public", publicSampleDir);

function velocityForLayer(index, total) {
  return Number(((index + 1) / total).toFixed(3));
}

async function assertFileExists(filePath) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Missing Home Kit sample: ${path.relative(rootDir, filePath)}`);
  }
}

async function main() {
  await assertFileExists(sourceDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const manifest = {
    id: "home-kit-balanced",
    name: "Strike Sound Home Kit Balanced",
    root: publicSampleDir,
    sampleRate: 44100,
    bitDepth: 24,
    layers: {},
  };

  let fileCount = 0;

  for (const source of homeKitSources) {
    manifest.layers[source.articulation] = {};

    for (const [mic, micSource] of Object.entries(source.mics)) {
      const layers = [];
      const articulationDir = path.join(outputDir, source.articulation);
      await mkdir(articulationDir, { recursive: true });

      for (let index = 0; index < micSource.layers.length; index += 1) {
        const layerNumber = micSource.layers[index];
        const sourceFile = path.join(sourceDir, micSource.folder, layerFileName(micSource.prefix, layerNumber));
        const relativePath = path.posix.join(source.articulation, normalizedFileName(mic, layerNumber));
        const destinationFile = path.join(outputDir, relativePath);

        await assertFileExists(sourceFile);
        await copyFile(sourceFile, destinationFile);

        layers.push({
          velocity: velocityForLayer(index, micSource.layers.length),
          path: relativePath,
        });
        fileCount += 1;
      }

      manifest.layers[source.articulation][mic] = layers;
    }
  }

  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Prepared ${fileCount} Home Kit samples in ${path.relative(rootDir, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
