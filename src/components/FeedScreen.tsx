import { useStore, streakDays, minutesThisWeek } from "../store";
import { SessionCard } from "./SessionCard";

export function FeedScreen() {
  const { state } = useStore();
  const streak = streakDays(state.mySessions);
  const mins = minutesThisWeek(state.mySessions);
  const goal = state.me?.weeklyGoalMin ?? 150;

  return (
    <div className="feed">
      <div className="feed-status">
        <div className="feed-stat">
          <span className="feed-stat-num">{streak > 0 ? `${streak}🔥` : "—"}</span>
          <span className="feed-stat-label">day streak</span>
        </div>
        <div className="feed-stat">
          <span className="feed-stat-num">
            {mins}
            <span className="feed-stat-sub">/{goal}m</span>
          </span>
          <span className="feed-stat-label">this week</span>
        </div>
        <div className="goal-track" aria-hidden>
          <div
            className="goal-fill"
            style={{ width: `${Math.min(100, (mins / Math.max(1, goal)) * 100)}%` }}
          />
        </div>
      </div>

      {state.feed.length === 0 && (
        <div className="empty">
          <p>The shed is quiet. Record your first session 🎙</p>
        </div>
      )}

      {state.feed.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}
