/** Encode mono Float32 samples as a 16-bit PCM WAV blob. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Compute `buckets` normalized peak values for waveform display. */
export function computePeaks(samples: Float32Array, buckets = 48): number[] {
  const peaks: number[] = new Array(buckets).fill(0);
  const per = Math.max(1, Math.floor(samples.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let max = 0;
    const start = b * per;
    const end = Math.min(samples.length, start + per);
    for (let i = start; i < end; i += 4) {
      const v = Math.abs(samples[i]);
      if (v > max) max = v;
    }
    peaks[b] = max;
  }
  const overall = Math.max(0.001, ...peaks);
  return peaks.map((p) => Math.round((p / overall) * 100) / 100);
}
