export type Visibility = "private" | "friends" | "public";

export type PieceStatus = "working" | "mastered";

export interface Piece {
  id: string;
  title: string;
  status: PieceStatus;
  addedAt: number;
}

export interface SessionAnalysis {
  durationSec: number;
  activeSec: number;
  keyName: string | null; // e.g. "G minor"
  keyConfidence: number; // 0..1
  bpm: number | null;
  notesPerMin: number;
  clipStartSec: number;
  clipDurSec: number;
  clipPeaks: number[]; // normalized 0..1 waveform buckets for the clip
}

export interface Author {
  id: string;
  handle: string;
  name: string;
  instrument: string;
  emoji: string;
  color: string;
  isBot: boolean;
}

export interface MeUser extends Author {
  weeklyGoalMin: number;
}

export interface FeedComment {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

export interface FeedSession {
  id: string;
  userId: string;
  startedAt: number;
  endedAt: number;
  caption: string;
  visibility: Visibility;
  demo: boolean;
  analysis: SessionAnalysis;
  pieceTitles: string[];
  clipId: string | null;
  author: Author | null;
  kudos: { userId: string; name: string }[];
  comments: FeedComment[];
}

export interface DiscoverUser extends Author {
  following: boolean;
  minutesThisWeek: number;
}

export interface LeaderRow {
  userId: string;
  name: string;
  emoji: string;
  minutes: number;
}

export interface SharePayload {
  startedAt: number;
  endedAt: number;
  caption: string;
  visibility: Visibility;
  demo: boolean;
  analysis: SessionAnalysis;
  pieceTitles: string[];
  clipWavBase64: string;
}
