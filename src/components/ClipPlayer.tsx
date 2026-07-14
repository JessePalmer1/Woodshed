import { useRef, useState } from "react";
import { fmtClock } from "../utils";

export function ClipPlayer({
  clipId,
  src,
  peaks,
}: {
  clipId?: string;
  src?: string; // local object URL (draft preview before upload)
  peaks: number[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [dur, setDur] = useState(0);

  const url = src ?? `/api/clips/${clipId}`;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play();
  };

  return (
    <div className="clip">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration > 0) setProgress(a.currentTime / a.duration);
        }}
      />
      <button className="clip-play" onClick={toggle} aria-label={playing ? "Pause" : "Play clip"}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" rx="1" />
            <rect x="14" y="4" width="5" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4.5v15l13-7.5Z" />
          </svg>
        )}
      </button>
      <div
        className="clip-wave"
        onClick={(e) => {
          const a = audioRef.current;
          if (!a || !a.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
        }}
      >
        {peaks.map((p, i) => (
          <span
            key={i}
            className={`wave-bar ${i / peaks.length <= progress ? "wave-played" : ""}`}
            style={{ height: `${Math.max(8, p * 100)}%` }}
          />
        ))}
      </div>
      <span className="clip-time">{fmtClock(dur || 0)}</span>
    </div>
  );
}
