/**
 * Explicit, visible session recorder: getUserMedia + MediaRecorder for capture,
 * an AnalyserNode for the live level meter. Analysis is deferred until stop.
 */

export class SessionRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private levelBuf: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  startedAt = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
    this.levelBuf = new Uint8Array(this.analyser.fftSize);

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(2000); // collect in 2s chunks
    this.startedAt = Date.now();
  }

  /** Live input level, 0..1 (RMS of the current analyser frame). */
  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.levelBuf);
    let sum = 0;
    for (let i = 0; i < this.levelBuf.length; i++) {
      const v = (this.levelBuf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.levelBuf.length) * 4);
  }

  /** Stop and decode the whole take into an AudioBuffer for analysis. */
  async stop(): Promise<AudioBuffer> {
    const recorder = this.recorder;
    if (!recorder) throw new Error("not recording");

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });

    this.stream?.getTracks().forEach((t) => t.stop());
    const ctx = this.ctx!;
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    await ctx.close();

    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.recorder = null;
    this.chunks = [];
    return audioBuf;
  }

  cancel(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.recorder = null;
    this.chunks = [];
  }
}
