import * as Tone from "tone";

export async function startToneAudio() {
  const toneContext = Tone.getContext();
  const rawContext = Tone.getContext().rawContext as AudioContext;

  const startTone = Tone.start().catch(() => undefined);
  const resumeTone = toneContext.resume().catch(() => undefined);
  const resumeRaw = rawContext.state === "running"
    ? Promise.resolve()
    : rawContext.resume().catch(() => undefined);

  await Promise.race([
    Promise.all([startTone, resumeTone, resumeRaw]),
    timeout("timeout" as const, 3000),
  ]);

  if (rawContext.state !== "running") {
    throw new Error("Audio is suspended. Click Preview again.");
  }
}

function timeout<T>(value: T, ms: number) {
  return new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}
