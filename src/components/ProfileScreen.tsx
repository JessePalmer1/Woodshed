import { useState } from "react";
import { useStore, streakDays, minutesThisWeek, last7Days, totals } from "../store";

export function ProfileScreen({ onOpenPiece }: { onOpenPiece: (title: string) => void }) {
  const { state, addPiece, setPieceStatus, setGoal, logout } = useStore();
  const [newPiece, setNewPiece] = useState("");
  const me = state.me!;

  const streak = streakDays(state.mySessions);
  const mins = minutesThisWeek(state.mySessions);
  const week = last7Days(state.mySessions);
  const tot = totals(state.mySessions);
  const maxDay = Math.max(30, ...week.map((d) => d.minutes));
  const goalFrac = Math.min(1, mins / Math.max(1, me.weeklyGoalMin));

  const sessionCountFor = (title: string) =>
    state.mySessions.filter((s) => s.pieceTitles.includes(title)).length;

  const submitPiece = async () => {
    const title = newPiece.trim();
    if (!title) return;
    setNewPiece("");
    await addPiece(title);
  };

  return (
    <div className="profile">
      <header className="profile-head">
        <span className="avatar avatar-lg" style={{ background: me.color }}>
          {me.emoji}
        </span>
        <div style={{ flex: 1 }}>
          <h2>{me.name}</h2>
          <p className="profile-meta">
            @{me.handle} · {me.instrument}
          </p>
        </div>
        <button className="icon-btn" title="Log out" onClick={logout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </header>

      <div className="stat-tiles">
        <div className="tile">
          <span className="tile-num">{streak}🔥</span>
          <span className="tile-label">day streak</span>
        </div>
        <div className="tile">
          <span className="tile-num">{tot.sessions}</span>
          <span className="tile-label">sessions</span>
        </div>
        <div className="tile">
          <span className="tile-num">{tot.hours}h</span>
          <span className="tile-label">all time</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>This week</h3>
          <span className="panel-sub">
            {mins} / {me.weeklyGoalMin} min
          </span>
        </div>
        <div className="goal-track goal-track-lg">
          <div className="goal-fill" style={{ width: `${goalFrac * 100}%` }} />
        </div>
        <div className="week-chart">
          {week.map((d, i) => (
            <div key={i} className="week-col">
              <div className="week-bar-wrap">
                <div
                  className={`week-bar ${d.minutes > 0 ? "week-bar-on" : ""}`}
                  style={{ height: `${Math.max(4, (d.minutes / maxDay) * 100)}%` }}
                  title={`${d.minutes} min`}
                />
              </div>
              <span className="week-label">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="goal-edit">
          <label>Weekly goal</label>
          <input
            type="range"
            min={30}
            max={600}
            step={15}
            value={me.weeklyGoalMin}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
          <span>{me.weeklyGoalMin}m</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Repertoire shelf</h3>
        </div>
        {state.pieces.length === 0 && (
          <p className="panel-empty">Add the pieces you're working on.</p>
        )}
        {(["working", "mastered"] as const).map((status) =>
          state.pieces.filter((p) => p.status === status).length > 0 ? (
            <div key={status}>
              <p className="shelf-label">{status === "working" ? "Working on" : "Mastered ✓"}</p>
              {state.pieces
                .filter((p) => p.status === status)
                .map((p) => (
                  <div key={p.id} className="shelf-row">
                    <button className="shelf-title" onClick={() => onOpenPiece(p.title)}>
                      {p.title}
                      <span className="shelf-count">
                        {sessionCountFor(p.title)} session{sessionCountFor(p.title) === 1 ? "" : "s"} ›
                      </span>
                    </button>
                    <button
                      className="icon-btn"
                      title={status === "working" ? "Mark mastered" : "Back to working"}
                      onClick={() =>
                        setPieceStatus(p.id, status === "working" ? "mastered" : "working")
                      }
                    >
                      {status === "working" ? "✓" : "↩"}
                    </button>
                  </div>
                ))}
            </div>
          ) : null
        )}
        <div className="add-piece-row">
          <input
            className="text-input"
            placeholder="Add a piece…"
            value={newPiece}
            onChange={(e) => setNewPiece(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPiece()}
          />
          <button className="btn-ghost" onClick={submitPiece}>
            Add
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Shed crew — this week</h3>
        </div>
        {state.leaderboard.map((row, i) => (
          <div key={row.userId} className={`lb-row ${row.userId === me.id ? "lb-me" : ""}`}>
            <span className="lb-rank">{i + 1}</span>
            <span className="lb-emoji">{row.emoji}</span>
            <span className="lb-name">{row.userId === me.id ? "You" : row.name}</span>
            <span className="lb-min">{row.minutes}m</span>
          </div>
        ))}
        <p className="panel-hint">Friendly tally, not a ladder. Kudos beat rankings. 🤝</p>
      </section>
    </div>
  );
}
