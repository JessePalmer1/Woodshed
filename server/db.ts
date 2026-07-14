import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, "data");
export const CLIP_DIR = path.join(DATA_DIR, "clips");
fs.mkdirSync(CLIP_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "woodshed.db"));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    instrument TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    weekly_goal_min INTEGER NOT NULL DEFAULT 150,
    pass_hash TEXT,
    salt TEXT,
    is_bot INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    followee_id TEXT NOT NULL,
    PRIMARY KEY (follower_id, followee_id)
  );

  CREATE TABLE IF NOT EXISTS pieces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'working',
    added_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration_sec REAL NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'friends',
    demo INTEGER NOT NULL DEFAULT 0,
    analysis_json TEXT NOT NULL,
    piece_titles_json TEXT NOT NULL DEFAULT '[]',
    clip_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at);

  CREATE TABLE IF NOT EXISTS kudos (
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    at INTEGER NOT NULL
  );
`);

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export interface UserRow {
  id: string;
  handle: string;
  name: string;
  instrument: string;
  emoji: string;
  color: string;
  weekly_goal_min: number;
  pass_hash: string | null;
  salt: string | null;
  is_bot: number;
  created_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  started_at: number;
  ended_at: number;
  duration_sec: number;
  caption: string;
  visibility: string;
  demo: number;
  analysis_json: string;
  piece_titles_json: string;
  clip_id: string | null;
}

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    instrument: u.instrument,
    emoji: u.emoji,
    color: u.color,
    isBot: u.is_bot === 1,
  };
}

/** Serialize a session row plus author/kudos/comments into the API shape. */
export function sessionToApi(row: SessionRow) {
  const author = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id) as
    | UserRow
    | undefined;
  const kudos = db
    .prepare(
      `SELECT k.user_id AS userId, u.name FROM kudos k JOIN users u ON u.id = k.user_id
       WHERE k.session_id = ? ORDER BY k.at`
    )
    .all(row.id) as { userId: string; name: string }[];
  const comments = db
    .prepare(
      `SELECT c.id, c.user_id AS userId, u.name, c.text, c.at
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.session_id = ? ORDER BY c.at`
    )
    .all(row.id) as { id: string; userId: string; name: string; text: string; at: number }[];

  return {
    id: row.id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    caption: row.caption,
    visibility: row.visibility,
    demo: row.demo === 1,
    analysis: JSON.parse(row.analysis_json),
    pieceTitles: JSON.parse(row.piece_titles_json),
    clipId: row.clip_id,
    author: author ? publicUser(author) : null,
    kudos,
    comments,
  };
}

export function isFollowing(followerId: string, followeeId: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
    .get(followerId, followeeId);
}

export function minutesThisWeek(userId: string): number {
  const ws = new Date();
  ws.setHours(0, 0, 0, 0);
  ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7)); // Monday
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(duration_sec), 0) AS sec FROM sessions WHERE user_id = ? AND started_at >= ?"
    )
    .get(userId, ws.getTime()) as { sec: number };
  return Math.round(row.sec / 60);
}
