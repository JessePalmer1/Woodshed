import { useStore } from "../store";
import { fmtDuration, timeAgo } from "../utils";
import { ClipPlayer } from "./ClipPlayer";

/**
 * Progress-over-time view for one piece: every session you've logged on it,
 * oldest first, so you can *hear* week 1 vs. now.
 */
export function PieceDetail({ title, onBack }: { title: string; onBack: () => void }) {
  const { state } = useStore();
  const sessions = state.mySessions
    .filter((s) => s.pieceTitles.includes(title))
    .sort((a, b) => a.startedAt - b.startedAt);

  const totalMin = Math.round(sessions.reduce((a, s) => a + s.analysis.durationSec, 0) / 60);

  return (
    <div className="piece-detail">
      <button className="btn-ghost back-btn" onClick={onBack}>
        ← Back
      </button>
      <h2>{title}</h2>
      <p className="piece-summary">
        {sessions.length} session{sessions.length === 1 ? "" : "s"} · {totalMin} min total —
        listen oldest to newest and hear the difference.
      </p>

      {sessions.length === 0 && (
        <div className="empty">
          <p>No sessions tagged with this piece yet. Tag it on your next post!</p>
        </div>
      )}

      <div className="timeline">
        {sessions.map((s, i) => (
          <div key={s.id} className="timeline-item">
            <div className="timeline-marker">
              <span className="timeline-dot" />
              {i < sessions.length - 1 && <span className="timeline-line" />}
            </div>
            <div className="timeline-body">
              <p className="timeline-meta">
                <strong>Session {i + 1}</strong> · {timeAgo(s.startedAt)} ·{" "}
                {fmtDuration(s.analysis.durationSec)}
                {s.analysis.bpm ? ` · ~${s.analysis.bpm} bpm` : ""}
              </p>
              {s.clipId && <ClipPlayer clipId={s.clipId} peaks={s.analysis.clipPeaks} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
