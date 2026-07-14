import { useState } from "react";
import { useStore } from "./store";
import { Onboarding } from "./components/Onboarding";
import { FeedScreen } from "./components/FeedScreen";
import { RecordScreen, DraftData } from "./components/RecordScreen";
import { DraftScreen } from "./components/DraftScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { PieceDetail } from "./components/PieceDetail";
import { PeopleScreen } from "./components/PeopleScreen";

export type Tab = "feed" | "record" | "profile";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 4 L29 13 L26 13 L26 27 L6 27 L6 13 L3 13 Z" fill="var(--accent)" />
      <circle cx="13.2" cy="21" r="2.7" fill="var(--bg)" />
      <rect x="15.2" y="11" width="1.9" height="10" fill="var(--bg)" />
      <rect x="15.2" y="11" width="5.5" height="1.9" fill="var(--bg)" />
    </svg>
  );
}

export default function App() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>("feed");
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [pieceDetail, setPieceDetail] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);

  if (state.booting) {
    return (
      <div className="onboarding ob-hero" style={{ justifyContent: "center", display: "flex" }}>
        <div className="ob-logo" style={{ alignSelf: "center", marginTop: "40vh" }}>
          <Logo size={56} />
        </div>
      </div>
    );
  }

  if (!state.me) return <Onboarding />;

  const overlayOpen = !!draft || !!pieceDetail || showPeople;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">woodshed</span>
        </div>
        <button
          className="icon-btn people-btn"
          title="Find your shed crew"
          onClick={() => {
            setPieceDetail(null);
            setShowPeople(true);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c1.2-3.2 4-4.5 6.5-4.5s5.3 1.3 6.5 4.5" />
            <circle cx="17.5" cy="9.5" r="2.5" />
            <path d="M16.5 15.6c2 .3 4 1.5 5 3.9" />
          </svg>
        </button>
      </header>

      <main className="screen">
        {draft ? (
          <DraftScreen
            draft={draft}
            onDone={(shared) => {
              setDraft(null);
              setTab(shared ? "feed" : "record");
            }}
          />
        ) : showPeople ? (
          <PeopleScreen onBack={() => setShowPeople(false)} />
        ) : pieceDetail ? (
          <PieceDetail title={pieceDetail} onBack={() => setPieceDetail(null)} />
        ) : tab === "feed" ? (
          <FeedScreen />
        ) : tab === "record" ? (
          <RecordScreen onDraft={setDraft} />
        ) : (
          <ProfileScreen onOpenPiece={setPieceDetail} />
        )}
      </main>

      {!draft && (
        <nav className="tabbar">
          <button
            className={`tab ${tab === "feed" && !overlayOpen ? "active" : ""}`}
            onClick={() => {
              setPieceDetail(null);
              setShowPeople(false);
              setTab("feed");
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
            </svg>
            <span>Feed</span>
          </button>
          <button
            className={`tab tab-record ${tab === "record" && !overlayOpen ? "active" : ""}`}
            onClick={() => {
              setPieceDetail(null);
              setShowPeople(false);
              setTab("record");
            }}
            aria-label="Record a session"
          >
            <span className="record-circle">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5Z" />
                <rect x="11" y="18" width="2" height="3" />
              </svg>
            </span>
          </button>
          <button
            className={`tab ${tab === "profile" && !overlayOpen ? "active" : ""}`}
            onClick={() => {
              setPieceDetail(null);
              setShowPeople(false);
              setTab("profile");
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 5-5.5 8-5.5S18.5 17 20 21" />
            </svg>
            <span>You</span>
          </button>
        </nav>
      )}
    </div>
  );
}
