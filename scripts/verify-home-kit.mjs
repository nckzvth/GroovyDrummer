import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { homeKitSources, normalizedFileName, publicSampleDir } from "./home-kit-config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "public", publicSampleDir);
const manifestPath = path.join(outputDir, "manifest.json");

async function assertFileExists(filePath) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Missing Home Kit asset: ${path.relative(rootDir, filePath)}`);
  }
}

function assertLowercaseRelativePath(value) {
  if (value !== value.toLowerCase() || value.includes("\\") || value.includes(" ")) {
    throw new Error(`Home Kit asset path is not normalized: ${value}`);
  }
}

async function main() {
  await assertFileExists(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (manifest.id !== "home-kit-balanced" || manifest.root !== publicSampleDir) {
    throw new Error("Home Kit manifest has an unexpected id or root.");
  }

  let expectedCount = 0;

  for (const source of homeKitSources) {
    const manifestArticulation = manifest.layers?.[source.articulation];
    if (!manifestArticulation) {
      throw new Error(`Missing Home Kit manifest articulation: ${source.articulation}`);
    }

    for (const [mic, micSource] of Object.entries(source.mics)) {
      const layers = manifestArticulation[mic];
      if (!Array.isArray(layers) || layers.length !== micSource.layers.length) {
        throw new Error(`Unexpected layer count for ${source.articulation}/${mic}`);
      }

      for (let index = 0; index < micSource.layers.length; index += 1) {
        const expectedPath = path.posix.join(source.articulation, normalizedFileName(mic, micSource.layers[index]));
        const layer = layers[index];
        if (layer.path !== expectedPath) {
          throw new Error(`Unexpected manifest path for ${source.articulation}/${mic}: ${layer.path}`);
        }
        assertLowercaseRelativePath(layer.path);
        await assertFileExists(path.join(outputDir, layer.path));
        expectedCount += 1;
      }
    }
  }

  console.log(`Verified ${expectedCount} Home Kit samples in ${path.relative(rootDir, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
