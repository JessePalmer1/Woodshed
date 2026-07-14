import { useEffect, useMemo, useState } from "react";
import { DraftData } from "./RecordScreen";
import { useStore, streakDays } from "../store";
import { Visibility } from "../types";
import { fmtDuration, dayKey } from "../utils";
import { autoCaption } from "../data/seed";
import { ClipPlayer } from "./ClipPlayer";

export function DraftScreen({
  draft,
  onDone,
}: {
  draft: DraftData;
  onDone: (shared: boolean) => void;
}) {
  const { state, share, addPiece } = useStore();
  const [selectedPieces, setSelectedPieces] = useState<string[]>([]);
  const [customPiece, setCustomPiece] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [caption, setCaption] = useState("");
  const [captionDirty, setCaptionDirty] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const a = draft.analysis;

  // local preview URL for the not-yet-uploaded clip
  const previewUrl = useMemo(
    () => (draft.clipBlob ? URL.createObjectURL(draft.clipBlob) : null),
    [draft.clipBlob]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // streak as it will be after this session posts
  const futureStreak = useMemo(() => {
    const current = streakDays(state.mySessions);
    const practicedToday = state.mySessions.some(
      (s) => dayKey(s.startedAt) === dayKey(Date.now())
    );
    return practicedToday ? current : current + 1;
  }, [state.mySessions]);

  // keep the auto-caption in sync with piece tags until the user edits it
  useEffect(() => {
    if (!captionDirty) setCaption(autoCaption(a, selectedPieces, futureStreak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPieces, captionDirty]);

  const togglePiece = (title: string) =>
    setSelectedPieces((sel) =>
      sel.includes(title) ? sel.filter((t) => t !== title) : [...sel, title]
    );

  const addCustomPiece = async () => {
    const title = customPiece.trim();
    if (!title) return;
    setCustomPiece("");
    setSelectedPieces((sel) => (sel.includes(title) ? sel : [...sel, title]));
    await addPiece(title);
  };

  const doShare = async () => {
    if (sharing) return;
    setSharing(true);
    setError(null);
    try {
      await share(
        {
          startedAt: draft.startedAt,
          endedAt: draft.endedAt,
          caption: caption.trim(),
          visibility,
          demo: !!draft.demo,
          analysis: a,
          pieceTitles: selectedPieces,
        },
        draft.clipBlob
      );
      onDone(true);
    } catch (e) {
      setSharing(false);
      setError(e instanceof Error ? e.message : "Upload failed — is the API running?");
    }
  };

  return (
    <div className="draft">
      <h2 className="draft-title">
        Nice shed. <span className="draft-sub">Here's your post — tweak and share.</span>
      </h2>

      <div className="draft-card">
        <div className="chip-row">
          <span className="stat-chip stat-chip-primary">⏱ {fmtDuration(a.durationSec)}</span>
          <span className="stat-chip">🎵 {fmtDuration(a.activeSec)} playing</span>
          {a.keyName && <span className="stat-chip">♪ {a.keyName}</span>}
          {a.bpm && <span className="stat-chip">◔ ~{a.bpm} bpm</span>}
          {a.notesPerMin > 0 && <span className="stat-chip">♬ {a.notesPerMin} notes/min</span>}
        </div>

        {previewUrl ? (
          <>
            <p className="draft-cliplabel">
              Your best moment (auto-picked from {fmtDuration(a.clipStartSec)} in):
            </p>
            <ClipPlayer src={previewUrl} peaks={a.clipPeaks} />
          </>
        ) : (
          <p className="draft-cliplabel">No clip for this session.</p>
        )}

        <textarea
          className="caption-input"
          value={caption}
          rows={2}
          onChange={(e) => {
            setCaption(e.target.value);
            setCaptionDirty(true);
          }}
        />
      </div>

      <div className="draft-section">
        <h3>What were you working on?</h3>
        <div className="chip-grid">
          {state.pieces.map((p) => (
            <button
              key={p.id}
              className={`chip ${selectedPieces.includes(p.title) ? "chip-on" : ""}`}
              onClick={() => togglePiece(p.title)}
            >
              {p.title}
            </button>
          ))}
        </div>
        <div className="add-piece-row">
          <input
            className="text-input"
            placeholder="Add a piece…"
            value={customPiece}
            onChange={(e) => setCustomPiece(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomPiece()}
          />
          <button className="btn-ghost" onClick={addCustomPiece}>
            Add
          </button>
        </div>
      </div>

      <div className="draft-section">
        <h3>Who can see this?</h3>
        <div className="seg">
          {(["private", "friends", "public"] as Visibility[]).map((v) => (
            <button
              key={v}
              className={`seg-btn ${visibility === v ? "seg-on" : ""}`}
              onClick={() => setVisibility(v)}
            >
              {v === "private" ? "🔒 Private" : v === "friends" ? "👥 Friends" : "🌍 Public"}
            </button>
          ))}
        </div>
        <p className="draft-hint">
          {visibility === "private"
            ? "Only you. Still counts toward your streak and stats."
            : visibility === "friends"
            ? "People who follow you can see and react."
            : "Anyone on Woodshed can see this session."}
        </p>
      </div>

      {error && <p className="record-error">{error}</p>}

      <button className="btn-primary share-btn" onClick={doShare} disabled={sharing}>
        {sharing ? "Uploading…" : visibility === "private" ? "Save session" : "Share to feed 🎉"}
      </button>
      <button className="btn-ghost" onClick={() => onDone(false)} disabled={sharing}>
        Discard
      </button>
    </div>
  );
}
