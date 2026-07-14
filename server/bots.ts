/**
 * The seed community: five bot musicians who post real (synthesized) sessions
 * and react to human posts. Runs entirely server-side so every new user lands
 * in a feed that's already alive.
 */

import fs from "node:fs";
import path from "node:path";
import { CLIP_DIR, db, uid, SessionRow } from "./db.ts";
import { synthesizeClip, SynthSpec } from "../src/audio/synth.ts";

interface Bot {
  handle: string;
  name: string;
  instrument: string;
  emoji: string;
  color: string;
  voice: SynthSpec["voice"];
  pieces: string[];
}

const BOTS: Bot[] = [
  { handle: "maya.keys", name: "Maya Lin", instrument: "Piano", emoji: "🎹", color: "#8ecae6", voice: "soft", pieces: ["Clair de Lune", "Bill Evans voicings", "Hanon 21–25"] },
  { handle: "dexlowend", name: "Dex Carter", instrument: "Upright bass", emoji: "🎻", color: "#c8a2ff", voice: "low", pieces: ["Autumn Leaves", "Walking lines in F", "Mr. P.C."] },
  { handle: "sofia.alto", name: "Sofia Reyes", instrument: "Alto sax", emoji: "🎷", color: "#ffb4a2", voice: "bright", pieces: ["Donna Lee", "Long tones", "II-V-I patterns"] },
  { handle: "jonahstrings", name: "Jonah Park", instrument: "Violin", emoji: "🎻", color: "#a3d9a5", voice: "bright", pieces: ["Bach Partita No. 2", "Kreutzer 8", "Meditation from Thaïs"] },
  { handle: "ruthie.gtr", name: "Ruthie Coleman", instrument: "Guitar", emoji: "🎸", color: "#f4d35e", voice: "pluck", pieces: ["Blackbird", "CAGED drills", "Little Wing"] },
];

const CAPTIONS = [
  "Slow practice, fast progress. Allegedly.",
  "The metronome and I are speaking again.",
  "Same four bars for 40 minutes and I regret nothing.",
  "Finally starting to breathe in the right places.",
  "Left hand knows the plan now. Right hand still negotiating.",
  "Good shed tonight. That bridge is *almost* mine.",
  "Ran it clean twice. Quitting while I'm ahead.",
  "Muscle memory loading… 73%.",
  "Today's tempo: honest. Tomorrow's tempo: ambitious.",
  "Some days you get the shed, some days the shed gets you.",
];

const COMMENTS = [
  "That clip is smooth 🔥",
  "Tempo's really settling in, nice.",
  "Okay that ending!! 👏",
  "The tone on this is so good",
  "Consistency king 🙌",
  "This piece is coming along fast",
  "I need to steal that lick",
  "Day after day — respect the streak",
  "Sounding way more confident than last week",
  "Those phrases breathe now. Big difference.",
];

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

function botIds(): string[] {
  return (db.prepare("SELECT id FROM users WHERE is_bot = 1").all() as { id: string }[]).map(
    (r) => r.id
  );
}

export function ensureBots(): void {
  const insert = db.prepare(
    `INSERT INTO users (id, handle, name, instrument, emoji, color, weekly_goal_min, is_bot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  for (const bot of BOTS) {
    const exists = db.prepare("SELECT 1 FROM users WHERE handle = ?").get(bot.handle);
    if (!exists) {
      insert.run(
        `bot-${bot.handle}`,
        bot.handle,
        bot.name,
        bot.instrument,
        bot.emoji,
        bot.color,
        randInt(120, 300),
        Date.now()
      );
    }
  }
  // bots follow each other so their feeds make sense conceptually
  const ids = botIds();
  const follow = db.prepare(
    "INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)"
  );
  for (const a of ids) for (const b of ids) if (a !== b) follow.run(a, b);
}

async function makeBotSession(botUserId: string, when: number): Promise<string> {
  const bot = BOTS.find((b) => `bot-${b.handle}` === botUserId)!;
  const keyRootPc = randInt(0, 11);
  const minor = Math.random() < 0.45;
  const bpm = randInt(66, 152);
  const durationSec = randInt(14, 72) * 60;

  const { blob, peaks } = synthesizeClip({ keyRootPc, minor, bpm, seconds: 12, voice: bot.voice });
  const clipId = `clip-${uid()}`;
  fs.writeFileSync(path.join(CLIP_DIR, `${clipId}.wav`), Buffer.from(await blob.arrayBuffer()));

  const analysis = {
    durationSec,
    activeSec: durationSec * (0.55 + Math.random() * 0.3),
    keyName: `${NOTE_NAMES[keyRootPc]} ${minor ? "minor" : "major"}`,
    keyConfidence: 0.5 + Math.random() * 0.4,
    bpm,
    notesPerMin: randInt(40, 160),
    clipStartSec: randInt(60, Math.max(61, durationSec - 20)),
    clipDurSec: 12,
    clipPeaks: peaks,
  };

  const id = uid();
  db.prepare(
    `INSERT INTO sessions (id, user_id, started_at, ended_at, duration_sec, caption, visibility, demo, analysis_json, piece_titles_json, clip_id)
     VALUES (?, ?, ?, ?, ?, ?, 'friends', 0, ?, ?, ?)`
  ).run(
    id,
    botUserId,
    when,
    when + durationSec * 1000,
    durationSec,
    pick(CAPTIONS),
    JSON.stringify(analysis),
    JSON.stringify([pick(bot.pieces)]),
    clipId
  );

  // bots kudos each other
  const others = botIds().filter((b) => b !== botUserId);
  for (const other of others.sort(() => Math.random() - 0.5).slice(0, randInt(0, 3))) {
    db.prepare("INSERT OR IGNORE INTO kudos (session_id, user_id, at) VALUES (?, ?, ?)").run(
      id,
      other,
      when + randInt(10, 300) * 60_000
    );
  }
  if (Math.random() < 0.3) {
    db.prepare("INSERT INTO comments (id, session_id, user_id, text, at) VALUES (?, ?, ?, ?, ?)").run(
      uid(),
      id,
      pick(others),
      pick(COMMENTS),
      when + randInt(10, 200) * 60_000
    );
  }
  return id;
}

/** First boot: ~10 days of history. Later boots: keep the feed fresh. */
export async function seedBotActivity(): Promise<void> {
  const count = (
    db.prepare("SELECT COUNT(*) AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.is_bot = 1").get() as { n: number }
  ).n;

  if (count === 0) {
    console.log("[bots] seeding 10 days of community history…");
    for (let dayOffset = -9; dayOffset <= 0; dayOffset++) {
      for (const id of botIds()) {
        if (Math.random() > 0.55) continue;
        const base = new Date();
        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() + dayOffset);
        const when = base.getTime() + randInt(8, 21) * 3600_000 + randInt(0, 3500) * 1000;
        if (when > Date.now() - 10 * 60_000) continue;
        await makeBotSession(id, when);
      }
    }
    console.log("[bots] seed complete");
    return;
  }

  const newest = (
    db.prepare(
      "SELECT MAX(s.started_at) AS t FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.is_bot = 1"
    ).get() as { t: number | null }
  ).t;
  if (newest && Date.now() - newest > 18 * 3600_000) {
    console.log("[bots] freshness pass: new posts from the crew");
    for (const id of botIds().sort(() => Math.random() - 0.5).slice(0, 2)) {
      await makeBotSession(id, Date.now() - randInt(30, 240) * 60_000);
    }
  }
}

/** Bots follow a new human and vice versa, so their feed starts alive. */
export function introduceBotsTo(userId: string): void {
  const follow = db.prepare(
    "INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)"
  );
  for (const botId of botIds()) {
    follow.run(userId, botId);
    follow.run(botId, userId);
  }
}

/** Reaction timers don't survive restarts — on boot, catch up on human posts that got nothing. */
export function backfillReactions(): void {
  const stale = db
    .prepare(
      `SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE u.is_bot = 0 AND s.visibility != 'private' AND s.ended_at < ?
         AND NOT EXISTS (SELECT 1 FROM kudos k WHERE k.session_id = s.id)`
    )
    .all(Date.now() - 5 * 60_000) as { id: string }[];
  for (const { id } of stale) {
    for (const botId of botIds().sort(() => Math.random() - 0.5).slice(0, randInt(1, 3))) {
      db.prepare("INSERT OR IGNORE INTO kudos (session_id, user_id, at) VALUES (?, ?, ?)").run(
        id,
        botId,
        Date.now()
      );
    }
    if (Math.random() < 0.5) {
      db.prepare("INSERT INTO comments (id, session_id, user_id, text, at) VALUES (?, ?, ?, ?, ?)").run(
        uid(),
        id,
        pick(botIds()),
        pick(COMMENTS),
        Date.now()
      );
    }
  }
}

/** Schedule kudos + a comment from bots on a fresh human session. */
export function reactToSession(sessionId: string): void {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as
    | SessionRow
    | undefined;
  if (!row || row.visibility === "private") return;

  const reactors = botIds()
    .sort(() => Math.random() - 0.5)
    .slice(0, randInt(2, 4));

  reactors.forEach((botId, i) => {
    setTimeout(() => {
      try {
        db.prepare("INSERT OR IGNORE INTO kudos (session_id, user_id, at) VALUES (?, ?, ?)").run(
          sessionId,
          botId,
          Date.now()
        );
      } catch (e) {
        console.error("[bots] kudos failed", e);
      }
    }, 6000 + i * randInt(6000, 15000));
  });

  setTimeout(() => {
    try {
      db.prepare("INSERT INTO comments (id, session_id, user_id, text, at) VALUES (?, ?, ?, ?, ?)").run(
        uid(),
        sessionId,
        pick(reactors),
        pick(COMMENTS),
        Date.now()
      );
    } catch (e) {
      console.error("[bots] comment failed", e);
    }
  }, randInt(25000, 50000));
}
