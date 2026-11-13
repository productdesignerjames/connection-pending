import { useEffect, useRef, useState } from "react";
import { Music, VolumeX } from "lucide-react";

const melody = [
  76, 0, 76, 79, 83, 0, 81, 79, 76, 74, 76, 0, 71, 74, 76, 0, 72, 79, 76, 0, 74,
  72, 71, 69, 72, 76, 79, 81, 79, 76, 72, 0, 74, 0, 81, 78, 76, 74, 78, 81, 86,
  0, 83, 81, 78, 76, 74, 0, 71, 78, 83, 0, 81, 78, 75, 71, 78, 75, 71, 69, 71,
  75, 78, 0,
];
const bassRoots = [40, 36, 38, 35];
const bassPattern = [0, 12, 0, 7, 0, 12, 10, 7];

type Playback = {
  context: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

function makeIntro(context: AudioContext): AudioBuffer {
  const sampleRate = 22_050;
  const stepSamples = Math.round((sampleRate * 60) / 144 / 4);
  const buffer = context.createBuffer(
    1,
    stepSamples * melody.length,
    sampleRate,
  );
  const samples = buffer.getChannelData(0);
  const frequencies = melody.map((note) =>
    note ? 440 * 2 ** ((note - 69) / 12) : 0,
  );
  const bassFrequencies = melody.map(
    (_, step) =>
      440 *
      2 **
        ((bassRoots[Math.floor(step / 16)] +
          bassPattern[Math.floor(step / 2) % bassPattern.length] -
          69) /
          12),
  );
  const kickSteps = [0, 6, 8, 11];
  const kickOffsets = Array.from(
    { length: 16 },
    (_, step) => step - (kickSteps.filter((kick) => kick <= step).at(-1) ?? 0),
  );
  const envelope = (time: number, duration: number) =>
    Math.max(0, Math.min(1, time / 0.004, (duration * 0.86 - time) / 0.024));
  let noiseState = 17;
  for (let index = 0; index < samples.length; index += 1) {
    const step = Math.floor(index / stepSamples);
    const position = index % stepSamples;
    const noteTime = position / sampleRate;
    const bassTime = (index % (stepSamples * 2)) / sampleRate;
    const frequency = frequencies[step];
    const angle = Math.PI * 2 * frequency * noteTime;
    const leadWave =
      Math.sin(angle + Math.sin(angle * 2) * 1.4) * 0.13 +
      ((noteTime * frequency) % 1 < 0.25 ? 0.06 : -0.06);
    const lead = frequency
      ? leadWave *
        envelope(noteTime, stepSamples / sampleRate) *
        (step % 4 === 0 ? 1 : 0.85)
      : 0;
    const bassPhase = (bassTime * bassFrequencies[step]) % 1;
    const low =
      ((1 - 4 * Math.abs(bassPhase - 0.5)) * 0.13 +
        (bassPhase < 0.5 ? 0.04 : -0.04)) *
      envelope(bassTime, (stepSamples * 2) / sampleRate);
    noiseState = (Math.imul(noiseState, 1_664_525) + 1_013_904_223) | 0;
    const noise = (noiseState >>> 0) / 2_147_483_648 - 1;
    const kickTime =
      (kickOffsets[step % 16] * stepSamples + position) / sampleRate;
    const kick =
      Math.sin(
        Math.PI * 2 * (52 * kickTime + 4.2 * (1 - Math.exp(-kickTime / 0.045))),
      ) *
      Math.exp(-kickTime * 22) *
      0.24;
    const snareTime = (((step + 4) % 8) * stepSamples + position) / sampleRate;
    const snare =
      (noise * 0.12 + Math.sin(snareTime * Math.PI * 360) * 0.035) *
      Math.exp(-snareTime * 34);
    const hat =
      noise * Math.exp(-noteTime * 90) * (step % 2 === 0 ? 0.025 : 0.015);
    const mixed = Math.max(
      -0.9,
      Math.min(0.9, lead + low + kick + snare + hat),
    );
    samples[index] = Math.round(mixed * 127) / 127;
  }
  return buffer;
}

function stopPlayback(playback: Playback | null) {
  if (!playback || playback.context.state === "closed") return;
  playback.gain.gain.value = 0;
  try {
    playback.source.stop();
  } catch {
    playback.source.disconnect();
  }
  void playback.context.close().catch(() => undefined);
}

export default function IntroMusicButton() {
  const playback = useRef<Playback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      stopPlayback(playback.current);
      playback.current = null;
      setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPlayback(playback.current);
      playback.current = null;
    };
  }, []);

  async function toggleMusic() {
    if (busy) return;
    setError("");
    if (playback.current) {
      stopPlayback(playback.current);
      playback.current = null;
      setPlaying(false);
      return;
    }
    setBusy(true);
    let next: Playback | null = null;
    try {
      const context = new AudioContext();
      const source = context.createBufferSource();
      const gain = context.createGain();
      next = { context, source, gain };
      playback.current = next;
      source.buffer = makeIntro(context);
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(context.destination);
      await context.resume();
      if (playback.current !== next || context.state === "closed") return;
      source.start();
      gain.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.06);
      setPlaying(true);
    } catch {
      stopPlayback(next);
      if (playback.current === next) playback.current = null;
      setPlaying(false);
      setError("Music is unavailable in this browser.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="intro-music-control">
      <button
        className="welcome-music-button"
        type="button"
        disabled={busy}
        aria-pressed={playing}
        aria-label={playing ? "Mute intro music" : "Play 8-bit intro music"}
        title={playing ? "Mute intro music" : "Play original 8-bit intro music"}
        onClick={() => void toggleMusic()}
      >
        {playing ? (
          <VolumeX size={18} aria-hidden="true" />
        ) : (
          <Music size={18} aria-hidden="true" />
        )}
        {playing ? "Mute music" : "Play music"}
      </button>
      {error && (
        <p className="intro-music-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
