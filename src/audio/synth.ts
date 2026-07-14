/**
 * Small additive-synthesis engine that renders plausible "practice clips" for
 * simulated friends and the demo session: plucked arpeggio/scale patterns in a
 * given key and tempo, with human timing and velocity jitter.
 */

import { computePeaks, encodeWav } from "./wav";

const SR = 22050;

export interface SynthSpec {
  keyRootPc: number; // 0 = C
  minor: boolean;
  bpm: number;
  seconds: number;
  /** timbre preset */
  voice: "pluck" | "soft" | "bright" | "low";
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

interface Voice {
  harmonics: number[];
  decay: number; // amplitude decay rate (per second)
  octave: number; // base octave offset from middle
}

const VOICES: Record<SynthSpec["voice"], Voice> = {
  pluck: { harmonics: [1, 0.55, 0.32, 0.2, 0.1], decay: 3.2, octave: 0 },
  soft: { harmonics: [1, 0.3, 0.12, 0.05, 0.02], decay: 1.8, octave: 0 },
  bright: { harmonics: [1, 0.7, 0.5, 0.35, 0.22], decay: 2.6, octave: 1 },
  low: { harmonics: [1, 0.45, 0.2, 0.08, 0.03], decay: 2.2, octave: -1 },
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function renderNote(
  out: Float32Array,
  startSample: number,
  freq: number,
  durSec: number,
  amp: number,
  voice: Voice
) {
  const n = Math.min(out.length - startSample, Math.floor(durSec * SR));
  const attack = Math.floor(0.006 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (let h = 0; h < voice.harmonics.length; h++) {
      const hf = freq * (h + 1);
      if (hf > SR / 2 - 500) break;
      s +=
        voice.harmonics[h] *
        Math.sin(2 * Math.PI * hf * t) *
        Math.exp(-t * voice.decay * (1 + h * 0.7));
    }
    const env = i < attack ? i / attack : 1;
    out[startSample + i] += s * amp * env * Math.exp(-t * voice.decay);
  }
}

/** Render a practice-like passage and return the WAV blob + waveform peaks. */
export function synthesizeClip(spec: SynthSpec): { blob: Blob; peaks: number[] } {
  const total = Math.floor(spec.seconds * SR);
  const out = new Float32Array(total);
  const voice = VOICES[spec.voice];
  const scale = spec.minor ? MINOR_SCALE : MAJOR_SCALE;
  const root = 60 + spec.keyRootPc + voice.octave * 12;

  const beatSec = 60 / spec.bpm;
  const eighth = beatSec / 2;

  // walk the scale with musical-ish motion: mostly steps, occasional leaps,
  // phrase pauses every 8–12 notes, an arpeggio burst now and then
  let degree = 0;
  let t = 0.15;
  let notesSincePause = 0;
  const phraseLen = 8 + Math.floor(Math.random() * 5);

  while (t < spec.seconds - 0.4) {
    const arpeggio = Math.random() < 0.15;
    if (arpeggio) {
      // triad arpeggio from the current degree
      for (let k = 0; k < 3 && t < spec.seconds - 0.4; k++) {
        const deg = degree + k * 2;
        const midi = root + 12 * Math.floor(deg / 7) + scale[((deg % 7) + 7) % 7];
        const jitter = (Math.random() - 0.5) * 0.02;
        renderNote(out, Math.floor((t + jitter) * SR), midiToFreq(midi), eighth * 2.5, 0.16 + Math.random() * 0.08, voice);
        t += eighth;
      }
      degree += 2;
    } else {
      const step = Math.random() < 0.72 ? (Math.random() < 0.6 ? 1 : -1) : Math.random() < 0.5 ? 2 : -2;
      degree += step;
      if (degree < -4) degree += 3;
      if (degree > 10) degree -= 3;
      const midi = root + 12 * Math.floor(degree / 7) + scale[((degree % 7) + 7) % 7];
      const jitter = (Math.random() - 0.5) * 0.025;
      const long = Math.random() < 0.18;
      renderNote(
        out,
        Math.floor(Math.max(0, t + jitter) * SR),
        midiToFreq(midi),
        long ? beatSec * 2 : eighth * 2.2,
        0.15 + Math.random() * 0.1,
        voice
      );
      t += long ? beatSec : eighth;
    }
    notesSincePause++;
    if (notesSincePause >= phraseLen) {
      t += beatSec * (0.5 + Math.random()); // breathe between phrases
      notesSincePause = 0;
      // sometimes land on the tonic to reinforce the key
      if (Math.random() < 0.5) degree = degree > 4 ? 7 : 0;
    }
  }

  // gentle limiter
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.95) {
    const g = 0.95 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }

  return { blob: encodeWav(out, SR), peaks: computePeaks(out) };
}
