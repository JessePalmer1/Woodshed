import { useStore } from "../store";

/** Discover & follow other musicians on this Woodshed server. */
export function PeopleScreen({ onBack }: { onBack: () => void }) {
  const { state, setFollow } = useStore();

  return (
    <div className="people">
      <button className="btn-ghost back-btn" onClick={onBack}>
        ← Back
      </button>
      <h2>Find your shed crew</h2>
      <p className="piece-summary">
        Follow people to see their sessions in your feed. Anyone who registers on this
        Woodshed server shows up here — open the app in another browser and invite a
        friend in.
      </p>

      {state.users.map((u) => (
        <div key={u.id} className="person-row">
          <span className="avatar" style={{ background: u.color, width: 44, height: 44, fontSize: 22 }}>
            {u.emoji}
          </span>
          <div className="person-info">
            <span className="person-name">
              {u.name}
              {u.isBot && <span className="badge-private">house band</span>}
            </span>
            <span className="card-meta">
              @{u.handle} · {u.instrument} · {u.minutesThisWeek}m this week
            </span>
          </div>
          <button
            className={`follow-btn ${u.following ? "follow-on" : ""}`}
            onClick={() => setFollow(u.id, !u.following)}
          >
            {u.following ? "Following" : "Follow"}
          </button>
        </div>
      ))}
    </div>
  );
}
