import { useState } from "react";
import { Logo } from "../App";
import { useStore } from "../store";
import { STARTER_PIECES } from "../data/seed";

const INSTRUMENTS: { name: string; emoji: string }[] = [
  { name: "Piano", emoji: "🎹" },
  { name: "Guitar", emoji: "🎸" },
  { name: "Bass", emoji: "🎸" },
  { name: "Violin", emoji: "🎻" },
  { name: "Saxophone", emoji: "🎷" },
  { name: "Trumpet", emoji: "🎺" },
  { name: "Drums", emoji: "🥁" },
  { name: "Voice", emoji: "🎤" },
  { name: "Other", emoji: "🎵" },
];

export function Onboarding() {
  const { login, register } = useStore();
  const [step, setStep] = useState(0); // 0 welcome, 1 profile, 2 pieces, 3 goal, 9 login
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [instrument, setInstrument] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [goal, setGoal] = useState(150);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = STARTER_PIECES[instrument ?? "Other"] ?? STARTER_PIECES.Other;
  const emoji = INSTRUMENTS.find((i) => i.name === instrument)?.emoji ?? "🎵";

  const suggestHandle = (n: string) =>
    n.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").slice(0, 24);

  const doRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        handle: handle.trim() || suggestHandle(name),
        password,
        instrument: instrument ?? "Other",
        emoji,
        weeklyGoalMin: goal,
        pieces: selected,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
      setBusy(false);
      setStep(1);
    }
  };

  const doLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(handle.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      {step === 0 && (
        <div className="ob-step ob-hero">
          <div className="ob-logo">
            <Logo size={64} />
          </div>
          <h1>woodshed</h1>
          <p className="ob-tag">Practice out loud.</p>
          <p className="ob-body">
            Tap once and play. Woodshed listens, figures out what you practiced, and turns it
            into a post your friends can cheer on — clip included. Everything is analyzed
            on your device, and every session is private until you say otherwise.
          </p>
          <button className="btn-primary" onClick={() => setStep(1)}>
            Join the shed
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setError(null);
              setStep(9);
            }}
          >
            Already shedding? Log in
          </button>
        </div>
      )}

      {step === 9 && (
        <div className="ob-step">
          <h2>Welcome back</h2>
          <label className="field-label">Handle</label>
          <input
            className="text-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. jesse.gtr"
            autoFocus
          />
          <label className="field-label">Password</label>
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
          {error && <p className="record-error">{error}</p>}
          <button className="btn-primary" disabled={busy || !handle.trim() || !password} onClick={doLogin}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="ob-step">
          <h2>Who's shedding?</h2>
          <label className="field-label">Your name</label>
          <input
            className="text-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!handleTouched) setHandle(suggestHandle(e.target.value));
            }}
            placeholder="e.g. Jesse"
            autoFocus
          />
          <label className="field-label">Handle</label>
          <input
            className="text-input"
            value={handle}
            onChange={(e) => {
              setHandleTouched(true);
              setHandle(e.target.value);
            }}
            placeholder="e.g. jesse.gtr"
          />
          <label className="field-label">Password</label>
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <label className="field-label">Your instrument</label>
          <div className="chip-grid">
            {INSTRUMENTS.map((i) => (
              <button
                key={i.name}
                className={`chip ${instrument === i.name ? "chip-on" : ""}`}
                onClick={() => setInstrument(i.name)}
              >
                {i.emoji} {i.name}
              </button>
            ))}
          </div>
          {error && <p className="record-error">{error}</p>}
          <button
            className="btn-primary"
            disabled={!name.trim() || !instrument || password.length < 6}
            onClick={() => setStep(2)}
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="ob-step">
          <h2>What are you working on?</h2>
          <p className="ob-body">
            Declare the pieces on your stand — Woodshed tags your sessions against this
            shelf instead of guessing songs blindly. You can add more anytime.
          </p>
          <div className="chip-grid">
            {suggestions.map((title) => (
              <button
                key={title}
                className={`chip ${selected.includes(title) ? "chip-on" : ""}`}
                onClick={() =>
                  setSelected((sel) =>
                    sel.includes(title) ? sel.filter((t) => t !== title) : [...sel, title]
                  )
                }
              >
                {title}
              </button>
            ))}
          </div>
          <div className="add-piece-row">
            <input
              className="text-input"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Add your own piece…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  setSelected((s) => [...s, custom.trim()]);
                  setCustom("");
                }
              }}
            />
            <button
              className="btn-ghost"
              onClick={() => {
                if (custom.trim()) {
                  setSelected((s) => [...s, custom.trim()]);
                  setCustom("");
                }
              }}
            >
              Add
            </button>
          </div>
          {selected.filter((t) => !suggestions.includes(t)).length > 0 && (
            <div className="chip-grid">
              {selected
                .filter((t) => !suggestions.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    className="chip chip-on"
                    onClick={() => setSelected((s) => s.filter((x) => x !== t))}
                  >
                    {t} ✕
                  </button>
                ))}
            </div>
          )}
          <button className="btn-primary" onClick={() => setStep(3)}>
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="ob-step">
          <h2>Weekly goal</h2>
          <p className="ob-body">How many minutes a week feels honest but ambitious?</p>
          <div className="goal-display">
            <span className="goal-num">{goal}</span>
            <span className="goal-unit">min / week</span>
          </div>
          <input
            type="range"
            min={30}
            max={600}
            step={15}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="goal-slider"
          />
          <p className="ob-hint">That's about {Math.round(goal / 7)} min a day.</p>
          {error && <p className="record-error">{error}</p>}
          <button className="btn-primary" disabled={busy} onClick={doRegister}>
            {busy ? "Setting up…" : "Open the shed 🔨"}
          </button>
        </div>
      )}

      {step > 0 && !busy && (
        <button className="ob-back" onClick={() => setStep(step === 9 ? 0 : step - 1)}>
          ← Back
        </button>
      )}
    </div>
  );
}
