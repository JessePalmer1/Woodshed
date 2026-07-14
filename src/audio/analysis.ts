/**
 * On-device session analysis: silence gating, pitch tracking (NSDF autocorrelation),
 * key detection (Krumhansl–Schmuckler), tempo estimation (onset autocorrelation),
 * and best-clip selection. Everything runs on downsampled mono audio so a long
 * session analyzes in a few seconds.
 */

import { SessionAnalysis } from "../types";
import { computePeaks, encodeWav } from "./wav";

export interface AnalyzedSession {
  analysis: SessionAnalysis;
  clipBlob: Blob | null;
}

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// Krumhansl–Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const CLIP_SEC = 12;

function mixToMono(buffer: AudioBuffer): Float32Array {
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return ch0;
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

function downsample(samples: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return samples;
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    const base = i * factor;
    for (let j = 0; j < factor; j++) sum += samples[base + j];
    out[i] = sum / factor;
  }
  return out;
}

/** RMS envelope with the given hop, frame = hop*2. */
function rmsEnvelope(samples: Float32Array, hop: number): Float32Array {
  const n = Math.max(0, Math.floor(samples.length / hop) - 1);
  const env = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = 0; i < hop * 2; i++) {
      const v = samples[start + i];
      sum += v * v;
    }
    env[f] = Math.sqrt(sum / (hop * 2));
  }
  return env;
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

/**
 * McLeod-style normalized square difference pitch detector for a single frame.
 * Returns { freq, clarity } or null.
 */
function detectPitch(
  frame: Float32Array,
  sampleRate: number,
  minFreq = 60,
  maxFreq = 1200
): { freq: number; clarity: number } | null {
  const n = frame.length;
  const maxLag = Math.min(n - 1, Math.floor(sampleRate / minFreq));
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));

  // NSDF: n'(tau) = 2*acf(tau) / (m(0) + m(tau))
  const nsdf = new Float32Array(maxLag + 1);
  let m0 = 0;
  for (let i = 0; i < n; i++) m0 += frame[i] * frame[i];
  if (m0 < 1e-6) return null;

  let mTau = 2 * m0;
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    for (let i = 0; i < n - tau; i++) acf += frame[i] * frame[i + tau];
    // approximate m(tau) with 2*m0 scaled by overlap fraction — cheap and stable enough
    mTau = 2 * m0 * ((n - tau) / n);
    nsdf[tau] = mTau > 0 ? (2 * acf) / (2 * m0 * ((n - tau) / n) + 1e-9) : 0;
    void mTau;
  }

  // find the highest peak after the first positive-going zero crossing
  let bestTau = -1;
  let bestVal = 0;
  let crossed = false;
  for (let tau = minLag + 1; tau < maxLag; tau++) {
    if (!crossed) {
      if (nsdf[tau] < 0) crossed = true;
      continue;
    }
    if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1] && nsdf[tau] > bestVal) {
      bestVal = nsdf[tau];
      bestTau = tau;
    }
  }
  if (bestTau < 0) {
    // no zero crossing (very periodic already) — take global max
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (nsdf[tau] > bestVal) {
        bestVal = nsdf[tau];
        bestTau = tau;
      }
    }
  }
  if (bestTau < minLag || bestVal < 0.5) return null;

  // parabolic interpolation around the peak
  const a = nsdf[bestTau - 1] ?? nsdf[bestTau];
  const b = nsdf[bestTau];
  const c = nsdf[bestTau + 1] ?? nsdf[bestTau];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const tau = bestTau + Math.max(-1, Math.min(1, shift));

  return { freq: sampleRate / tau, clarity: Math.min(1, bestVal) };
}

function keyFromChroma(chroma: number[]): { name: string; confidence: number } | null {
  const total = chroma.reduce((a, b) => a + b, 0);
  if (total < 1e-6) return null;
  const norm = chroma.map((c) => c / total);

  let best = { score: -Infinity, name: "" };
  let second = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const [profile, mode] of [
      [MAJOR_PROFILE, "major"],
      [MINOR_PROFILE, "minor"],
    ] as const) {
      // Pearson correlation between rotated chroma and profile
      const rotated = norm.map((_, i) => norm[(i + root) % 12]);
      const mp = profile.reduce((a, b) => a + b, 0) / 12;
      const mc = rotated.reduce((a, b) => a + b, 0) / 12;
      let num = 0,
        dp = 0,
        dc = 0;
      for (let i = 0; i < 12; i++) {
        num += (profile[i] - mp) * (rotated[i] - mc);
        dp += (profile[i] - mp) ** 2;
        dc += (rotated[i] - mc) ** 2;
      }
      const score = num / Math.sqrt(dp * dc + 1e-9);
      if (score > best.score) {
        second = best.score;
        best = { score, name: `${NOTE_NAMES[root]} ${mode}` };
      } else if (score > second) {
        second = score;
      }
    }
  }
  const confidence = Math.max(0, Math.min(1, (best.score - second) * 4 + best.score * 0.3));
  return { name: best.name, confidence };
}

function estimateTempo(env: Float32Array, envRate: number): number | null {
  // onset strength: half-wave rectified first difference
  const onset = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);

  const mean = onset.reduce((a, b) => a + b, 0) / onset.length;
  for (let i = 0; i < onset.length; i++) onset[i] -= mean;

  const minLag = Math.floor((60 / 190) * envRate); // 190 bpm
  const maxLag = Math.ceil((60 / 55) * envRate); // 55 bpm
  if (onset.length < maxLag * 3) return null;

  let bestLag = -1;
  let bestVal = 0;
  let zeroLag = 0;
  for (let i = 0; i < onset.length; i++) zeroLag += onset[i] * onset[i];
  if (zeroLag < 1e-9) return null;

  const scores: { lag: number; val: number }[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < onset.length - lag; i++) sum += onset[i] * onset[i + lag];
    const val = sum / zeroLag;
    scores.push({ lag, val });
    if (val > bestVal) {
      bestVal = val;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestVal < 0.12) return null;

  let bpm = (60 * envRate) / bestLag;
  // octave correction: prefer 70–150 range when the half/double candidate scores close
  const candidateAt = (target: number) => {
    const lag = Math.round((60 / target) * envRate);
    const s = scores.find((x) => Math.abs(x.lag - lag) <= 1);
    return s ? s.val : 0;
  };
  if (bpm > 150 && candidateAt(bpm / 2) > bestVal * 0.6) bpm = bpm / 2;
  else if (bpm < 70 && candidateAt(bpm * 2) > bestVal * 0.6) bpm = bpm * 2;

  return Math.round(bpm);
}

/**
 * Analyze a recorded session. Yields to the event loop periodically so the UI
 * spinner keeps animating; reports progress 0..1.
 */
export async function analyzeSession(
  buffer: AudioBuffer,
  onProgress?: (frac: number, label: string) => void
): Promise<AnalyzedSession> {
  const report = (f: number, l: string) => onProgress?.(f, l);
  const yieldUi = () => new Promise<void>((r) => setTimeout(r, 0));

  report(0.05, "Preparing audio");
  const mono = mixToMono(buffer);
  const srcRate = buffer.sampleRate;

  // ~22 kHz working copy (clip quality), ~11 kHz for pitch (speed)
  const f22 = Math.max(1, Math.round(srcRate / 22050));
  const work = downsample(mono, f22);
  const workRate = srcRate / f22;
  const pitchSig = downsample(work, 2);
  const pitchRate = workRate / 2;

  const durationSec = buffer.duration;

  // ---- energy envelope + silence gating -------------------------------------
  report(0.15, "Trimming silence");
  await yieldUi();
  const hop = 256;
  const env = rmsEnvelope(work, hop);
  const envRate = workRate / hop;
  const loud = percentile(env, 0.9);
  const gate = Math.max(0.004, loud * 0.12);
  let activeFrames = 0;
  const active: boolean[] = new Array(env.length);
  for (let i = 0; i < env.length; i++) {
    active[i] = env[i] > gate;
    if (active[i]) activeFrames++;
  }
  const activeSec = activeFrames / envRate;

  // ---- pitch track (strided so long sessions stay fast) ---------------------
  report(0.3, "Tracking pitch");
  const frameSize = 1024;
  const totalPitchFrames = Math.floor((pitchSig.length - frameSize) / (hop / 2));
  const maxAnalyzed = 5000;
  const stride = Math.max(1, Math.ceil(totalPitchFrames / maxAnalyzed));
  const chroma = new Array(12).fill(0);
  const clarityByEnvFrame = new Float32Array(env.length);
  let noteEvents = 0;
  let lastPc = -1;
  let claritySum = 0;
  let pitchedCount = 0;

  const frame = new Float32Array(frameSize);
  for (let f = 0, done = 0; f < totalPitchFrames; f += stride, done++) {
    const start = f * (hop / 2);
    const envIdx = Math.min(env.length - 1, Math.floor((start / pitchSig.length) * env.length));
    if (!active[envIdx]) continue;

    frame.set(pitchSig.subarray(start, start + frameSize));
    const p = detectPitch(frame, pitchRate);
    if (p && p.clarity > 0.6) {
      const midi = 69 + 12 * Math.log2(p.freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += p.clarity;
      clarityByEnvFrame[envIdx] = Math.max(clarityByEnvFrame[envIdx], p.clarity);
      claritySum += p.clarity;
      pitchedCount++;
      if (pc !== lastPc) {
        noteEvents++;
        lastPc = pc;
      }
    } else {
      lastPc = -1;
    }
    if (done % 250 === 0) {
      report(0.3 + 0.45 * (f / totalPitchFrames), "Tracking pitch");
      await yieldUi();
    }
  }

  // ---- key + tempo -----------------------------------------------------------
  report(0.8, "Finding key & tempo");
  await yieldUi();
  const key = pitchedCount >= 12 ? keyFromChroma(chroma) : null;
  const bpm = activeSec > 20 ? estimateTempo(env, envRate) : null;
  const notesPerMin =
    activeSec > 5 ? Math.round((noteEvents * stride) / (activeSec / 60)) : 0;

  // ---- best clip --------------------------------------------------------------
  report(0.9, "Choosing your best moment");
  await yieldUi();
  const clipFrames = Math.min(env.length, Math.round(CLIP_SEC * envRate));
  let bestStart = 0;
  let bestScore = -1;
  const stepFrames = Math.max(1, Math.round(envRate)); // 1s hop
  for (let s = 0; s + clipFrames <= env.length; s += stepFrames) {
    let energy = 0;
    let activeCount = 0;
    let clarity = 0;
    for (let i = s; i < s + clipFrames; i++) {
      energy += env[i];
      if (active[i]) activeCount++;
      clarity += clarityByEnvFrame[i];
    }
    const score =
      (energy / clipFrames) *
      (0.3 + 0.7 * (activeCount / clipFrames)) *
      (1 + clarity / clipFrames);
    if (score > bestScore) {
      bestScore = score;
      bestStart = s;
    }
  }
  const clipStartSec = bestStart / envRate;
  const clipDurSec = Math.min(CLIP_SEC, durationSec - clipStartSec);
  const clipStartSample = Math.floor(clipStartSec * workRate);
  const clipSamples = work.slice(
    clipStartSample,
    clipStartSample + Math.floor(clipDurSec * workRate)
  );

  // normalize clip loudness a bit
  let peak = 0;
  for (let i = 0; i < clipSamples.length; i++) peak = Math.max(peak, Math.abs(clipSamples[i]));
  if (peak > 0.01) {
    const gain = Math.min(4, 0.9 / peak);
    for (let i = 0; i < clipSamples.length; i++) clipSamples[i] *= gain;
  }

  const clipBlob = clipSamples.length > 0 ? encodeWav(clipSamples, Math.round(workRate)) : null;
  const clipPeaks = computePeaks(clipSamples);

  report(1, "Done");
  return {
    analysis: {
      durationSec,
      activeSec,
      keyName: key && key.confidence > 0.25 ? key.name : null,
      keyConfidence: key?.confidence ?? 0,
      bpm,
      notesPerMin,
      clipStartSec,
      clipDurSec,
      clipPeaks,
    },
    clipBlob,
  };
}
