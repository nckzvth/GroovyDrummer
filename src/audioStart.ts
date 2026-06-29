import * as Tone from "tone";

export async function startToneAudio() {
  const toneContext = Tone.getContext();
  const rawContext = Tone.getContext().rawContext as AudioContext;
  const result = await Promise.race([
    Tone.start().then(() => "started" as const),
    timeout("timeout" as const, 2500),
  ]);

  if (result === "timeout" && rawContext.state !== "running") {
    await Promise.race([
      toneContext.resume().catch(() => undefined),
      timeout(undefined, 1200),
    ]);
  }
}

function timeout<T>(value: T, ms: number) {
  return new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}
