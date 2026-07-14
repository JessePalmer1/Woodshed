import { useEffect, useRef, useState } from "react";
import { SessionRecorder } from "../audio/recorder";
import { analyzeSession } from "../audio/analysis";
import { synthesizeClip } from "../audio/synth";
import { SessionAnalysis } from "../types";
import { fmtClock, randInt } from "../utils";

export interface DraftData {
  analysis: SessionAnalysis;
  clipBlob: Blob | null;
  startedAt: number;
  endedAt: number;
  demo?: boolean;
}

type Phase = "idle" | "recording" | "analyzing";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function RecordScreen({ onDraft }: { onDraft: (d: DraftData) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(new Array(24).fill(0));
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      recorderRef.current?.cancel();
    };
  }, []);

  const start = async () => {
    setError(null);
    const rec = new SessionRecorder();
    try {
      await rec.start();
    } catch {
      setError(
        "Woodshed needs microphone access to log your session. Allow the mic and try again — audio never leaves your device."
      );
      return;
    }
    recorderRef.current = rec;
    setPhase("recording");
    const tick = () => {
      setElapsed((Date.now() - rec.startedAt) / 1000);
      setLevels((prev) => [...prev.slice(1), rec.level()]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    cancelAnimationFrame(rafRef.current);
    const startedAt = rec.startedAt;

    if (Date.now() - startedAt < 5000) {
      rec.cancel();
      recorderRef.current = null;
      setPhase("idle");
      setElapsed(0);
      setError("That was quick! Sessions need at least a few seconds of playing.");
      return;
    }

    setPhase("analyzing");
    setProgress(0.02);
    setProgressLabel("Wrapping up the take");
    try {
      const buffer = await rec.stop();
      recorderRef.current = null;
      const result = await analyzeSession(buffer, (f, l) => {
        setProgress(f);
        setProgressLabel(l);
      });
      onDraft({
        analysis: result.analysis,
        clipBlob: result.clipBlob,
        startedAt,
        endedAt: Date.now(),
      });
    } catch (e) {
      console.error(e);
      setPhase("idle");
      setElapsed(0);
      setError("Something went wrong analyzing that take. Try again?");
    }
  };

  const demoSession = () => {
    setPhase("analyzing");
    setProgress(0.4);
    setProgressLabel("Synthesizing a demo session");
    // Give the spinner a beat so the flow feels real
    setTimeout(() => {
      const keyRootPc = randInt(0, 11);
      const minor = Math.random() < 0.5;
      const bpm = randInt(72, 144);
      const { blob, peaks } = synthesizeClip({ keyRootPc, minor, bpm, seconds: 14, voice: "pluck" });
      const durationMin = randInt(18, 46);
      const durationSec = durationMin * 60;
      const endedAt = Date.now();
      onDraft({
        analysis: {
          durationSec,
          activeSec: durationSec * 0.72,
          keyName: `${NOTE_NAMES[keyRootPc]} ${minor ? "minor" : "major"}`,
          keyConfidence: 0.8,
          bpm,
          notesPerMin: randInt(60, 140),
          clipStartSec: randInt(120, durationSec - 30),
          clipDurSec: 14,
          clipPeaks: peaks,
        },
        clipBlob: blob,
        startedAt: endedAt - durationSec * 1000,
        endedAt,
        demo: true,
      });
    }, 900);
  };

  if (phase === "analyzing") {
    return (
      <div className="record-screen">
        <div className="analyzing">
          <div className="analyze-ring">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--card-border)" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progress * 326.7} 326.7`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <span className="analyze-pct">{Math.round(progress * 100)}%</span>
          </div>
          <h2>Listening back…</h2>
          <p className="analyze-label">{progressLabel}</p>
          <p className="record-hint">On-device analysis — your audio never leaves this browser.</p>
        </div>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="record-screen">
        <div className="rec-live">
          <span className="rec-dot" /> RECORDING
        </div>
        <div className="rec-timer">{fmtClock(elapsed)}</div>
        <div className="level-meter">
          {levels.map((l, i) => (
            <span
              key={i}
              className="level-bar"
              style={{ height: `${6 + l * 94}%`, opacity: 0.35 + (i / levels.length) * 0.65 }}
            />
          ))}
        </div>
        <p className="record-hint">
          Just play. Woodshed is timing the session and will pick your best moment when
          you stop.
        </p>
        <button className="stop-btn" onClick={stop} aria-label="Stop session">
          <span className="stop-square" />
        </button>
        <button
          className="btn-ghost rec-cancel"
          onClick={() => {
            recorderRef.current?.cancel();
            recorderRef.current = null;
            cancelAnimationFrame(rafRef.current);
            setPhase("idle");
            setElapsed(0);
          }}
        >
          Discard session
        </button>
      </div>
    );
  }

  return (
    <div className="record-screen">
      <h2 className="record-title">Time to shed</h2>
      <p className="record-sub">
        One tap, then just play. Duration, key, tempo and your best 12 seconds are
        detected automatically when you stop.
      </p>
      <button className="big-record" onClick={start} aria-label="Start session">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5Z" />
          <rect x="11" y="18" width="2" height="3" />
        </svg>
        <span>Start session</span>
      </button>
      {error && <p className="record-error">{error}</p>}
      <p className="record-hint">
        🔒 Explicit session only — no background listening, all analysis on-device.
      </p>
      <button className="btn-ghost demo-btn" onClick={demoSession}>
        No instrument handy? Run a demo session ✨
      </button>
    </div>
  );
}
