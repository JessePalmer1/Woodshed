import { useState } from "react";
import { FeedSession } from "../types";
import { useStore } from "../store";
import { fmtDuration, timeAgo } from "../utils";
import { ClipPlayer } from "./ClipPlayer";
import { exportShareCard } from "./shareCard";

function Avatar({ emoji, color, size = 40 }: { emoji: string; color: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.5 }}
    >
      {emoji}
    </span>
  );
}

export function SessionCard({ session }: { session: FeedSession }) {
  const { state, toggleKudos, addComment } = useStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const me = state.me!;
  const isMine = session.userId === me.id;
  const author = session.author;
  const name = isMine ? "You" : author?.name ?? "Unknown";
  const iKudoed = session.kudos.some((k) => k.userId === me.id);
  const a = session.analysis;

  const kudosLabel = () => {
    if (session.kudos.length === 0) return null;
    const names = session.kudos
      .slice(0, 3)
      .map((k) => (k.userId === me.id ? "You" : k.name.split(" ")[0]));
    const extra = session.kudos.length - names.length;
    return `👏 ${names.join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await addComment(session.id, text);
      setCommentText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card">
      <header className="card-head">
        <Avatar emoji={author?.emoji ?? "🎵"} color={author?.color ?? "var(--accent-dim)"} />
        <div className="card-who">
          <span className="card-name">
            {name}
            {session.demo && <span className="badge-demo">demo</span>}
            {session.visibility === "private" && <span className="badge-private">only you</span>}
          </span>
          <span className="card-meta">
            {author?.instrument} · {timeAgo(session.endedAt)}
          </span>
        </div>
        {isMine && (
          <button
            className="icon-btn"
            title="Export share card (PNG)"
            onClick={() => exportShareCard(session, me.name, me.instrument)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M4 21h16" />
            </svg>
          </button>
        )}
      </header>

      {session.caption && <p className="card-caption">{session.caption}</p>}

      <div className="chip-row">
        <span className="stat-chip stat-chip-primary">⏱ {fmtDuration(a.durationSec)}</span>
        {a.keyName && <span className="stat-chip">♪ {a.keyName}</span>}
        {a.bpm && <span className="stat-chip">◔ ~{a.bpm} bpm</span>}
        {session.pieceTitles.map((t) => (
          <span key={t} className="stat-chip stat-chip-piece">
            {t}
          </span>
        ))}
      </div>

      {session.clipId && <ClipPlayer clipId={session.clipId} peaks={a.clipPeaks} />}

      <footer className="card-foot">
        <button
          className={`kudos-btn ${iKudoed ? "kudos-on" : ""}`}
          onClick={() => toggleKudos(session.id)}
          disabled={isMine}
          title={isMine ? "Your friends give you kudos" : "Give kudos"}
        >
          👏 <span>{session.kudos.length > 0 ? session.kudos.length : "Kudos"}</span>
        </button>
        <button className="comment-btn" onClick={() => setShowComments((s) => !s)}>
          💬 <span>{session.comments.length > 0 ? session.comments.length : "Comment"}</span>
        </button>
        {kudosLabel() && <span className="kudos-names">{kudosLabel()}</span>}
      </footer>

      {showComments && (
        <div className="comments">
          {session.comments.map((c) => (
            <div key={c.id} className="comment">
              <strong>{c.userId === me.id ? "You" : c.name.split(" ")[0]}</strong> {c.text}
            </div>
          ))}
          <div className="comment-input-row">
            <input
              className="text-input comment-input"
              placeholder="Say something encouraging…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
            />
          </div>
        </div>
      )}
    </article>
  );
}
