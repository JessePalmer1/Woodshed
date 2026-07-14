import express from "express";
import fs from "node:fs";
import path from "node:path";
import {
  CLIP_DIR,
  db,
  isFollowing,
  minutesThisWeek,
  publicUser,
  sessionToApi,
  SessionRow,
  uid,
  UserRow,
} from "./db.ts";
import { AuthedRequest, hashPassword, issueToken, requireAuth, verifyPassword } from "./auth.ts";
import {
  backfillReactions,
  ensureBots,
  introduceBotsTo,
  reactToSession,
  seedBotActivity,
} from "./bots.ts";

const PORT = 3001;
const app = express();
app.use(express.json({ limit: "25mb" }));

const HUMAN_COLORS = ["#f4978e", "#90dbf4", "#b9fbc0", "#ffd6a5", "#cdb4db", "#fdffb6", "#9bf6ff"];

// ---------- auth ----------

app.post("/api/register", (req, res) => {
  const { name, handle, password, instrument, emoji, weeklyGoalMin, pieces } = req.body ?? {};
  if (!name || !handle || !password || !instrument) {
    return res.status(400).json({ error: "name, handle, password and instrument are required" });
  }
  const cleanHandle = String(handle).toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 24);
  if (!cleanHandle) return res.status(400).json({ error: "invalid handle" });
  if (db.prepare("SELECT 1 FROM users WHERE handle = ?").get(cleanHandle)) {
    return res.status(409).json({ error: "handle already taken" });
  }

  const { hash, salt } = hashPassword(String(password));
  const id = uid();
  const color = HUMAN_COLORS[Math.abs([...cleanHandle].reduce((a, c) => a + c.charCodeAt(0), 0)) % HUMAN_COLORS.length];
  db.prepare(
    `INSERT INTO users (id, handle, name, instrument, emoji, color, weekly_goal_min, pass_hash, salt, is_bot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    cleanHandle,
    String(name).slice(0, 40),
    String(instrument).slice(0, 30),
    String(emoji || "🎵").slice(0, 8),
    color,
    Number(weeklyGoalMin) || 150,
    hash,
    salt,
    Date.now()
  );

  if (Array.isArray(pieces)) {
    const insert = db.prepare(
      "INSERT INTO pieces (id, user_id, title, status, added_at) VALUES (?, ?, ?, 'working', ?)"
    );
    for (const title of pieces.slice(0, 20)) {
      insert.run(uid(), id, String(title).slice(0, 80), Date.now());
    }
  }

  introduceBotsTo(id);
  const token = issueToken(id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  res.json({ token, user: { ...publicUser(user), weeklyGoalMin: user.weekly_goal_min } });
});

app.post("/api/login", (req, res) => {
  const { handle, password } = req.body ?? {};
  const user = db
    .prepare("SELECT * FROM users WHERE handle = ? AND is_bot = 0")
    .get(String(handle ?? "").toLowerCase()) as UserRow | undefined;
  if (!user || !user.pass_hash || !user.salt || !verifyPassword(String(password ?? ""), user.salt, user.pass_hash)) {
    return res.status(401).json({ error: "wrong handle or password" });
  }
  const token = issueToken(user.id);
  res.json({ token, user: { ...publicUser(user), weeklyGoalMin: user.weekly_goal_min } });
});

// ---------- me ----------

app.get("/api/me", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const pieces = db
    .prepare("SELECT id, title, status, added_at AS addedAt FROM pieces WHERE user_id = ? ORDER BY added_at")
    .all(user.id);
  const sessions = (
    db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC").all(user.id) as SessionRow[]
  ).map(sessionToApi);
  res.json({
    user: { ...publicUser(user), weeklyGoalMin: user.weekly_goal_min },
    pieces,
    sessions,
  });
});

app.patch("/api/me", requireAuth, (req: AuthedRequest, res) => {
  const goal = Number(req.body?.weeklyGoalMin);
  if (Number.isFinite(goal) && goal >= 15 && goal <= 3000) {
    db.prepare("UPDATE users SET weekly_goal_min = ? WHERE id = ?").run(Math.round(goal), req.userId);
  }
  res.json({ ok: true });
});

// ---------- pieces ----------

app.post("/api/pieces", requireAuth, (req: AuthedRequest, res) => {
  const title = String(req.body?.title ?? "").trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: "title required" });
  const existing = db
    .prepare("SELECT id FROM pieces WHERE user_id = ? AND LOWER(title) = LOWER(?)")
    .get(req.userId, title);
  if (!existing) {
    db.prepare("INSERT INTO pieces (id, user_id, title, status, added_at) VALUES (?, ?, ?, 'working', ?)").run(
      uid(),
      req.userId,
      title,
      Date.now()
    );
  }
  res.json({ ok: true });
});

app.patch("/api/pieces/:id", requireAuth, (req: AuthedRequest, res) => {
  const status = req.body?.status === "mastered" ? "mastered" : "working";
  db.prepare("UPDATE pieces SET status = ? WHERE id = ? AND user_id = ?").run(
    status,
    req.params.id,
    req.userId
  );
  res.json({ ok: true });
});

// ---------- sessions & feed ----------

app.post("/api/sessions", requireAuth, (req: AuthedRequest, res) => {
  const { startedAt, endedAt, caption, visibility, demo, analysis, pieceTitles, clipWavBase64 } =
    req.body ?? {};
  if (!analysis || !Number.isFinite(Number(startedAt)) || !Number.isFinite(Number(endedAt))) {
    return res.status(400).json({ error: "invalid session payload" });
  }

  let clipId: string | null = null;
  if (typeof clipWavBase64 === "string" && clipWavBase64.length > 0) {
    clipId = `clip-${uid()}`;
    fs.writeFileSync(path.join(CLIP_DIR, `${clipId}.wav`), Buffer.from(clipWavBase64, "base64"));
  }

  const id = uid();
  const vis = ["private", "friends", "public"].includes(visibility) ? visibility : "friends";
  db.prepare(
    `INSERT INTO sessions (id, user_id, started_at, ended_at, duration_sec, caption, visibility, demo, analysis_json, piece_titles_json, clip_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    Number(startedAt),
    Number(endedAt),
    Number(analysis.durationSec) || (Number(endedAt) - Number(startedAt)) / 1000,
    String(caption ?? "").slice(0, 500),
    vis,
    demo ? 1 : 0,
    JSON.stringify(analysis),
    JSON.stringify(Array.isArray(pieceTitles) ? pieceTitles.slice(0, 10) : []),
    clipId
  );

  reactToSession(id);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow;
  res.json(sessionToApi(row));
});

app.get("/api/feed", requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT s.* FROM sessions s
       WHERE s.user_id = ?
          OR (s.visibility != 'private' AND s.user_id IN
              (SELECT followee_id FROM follows WHERE follower_id = ?))
       ORDER BY s.started_at DESC LIMIT 100`
    )
    .all(req.userId, req.userId) as SessionRow[];
  res.json(rows.map(sessionToApi));
});

app.get("/api/clips/:id", (req, res) => {
  const id = String(req.params.id).replace(/[^a-zA-Z0-9-]/g, "");
  const file = path.join(CLIP_DIR, `${id}.wav`);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.type("audio/wav").sendFile(file);
});

app.post("/api/sessions/:id/kudos", requireAuth, (req: AuthedRequest, res) => {
  const sessionId = req.params.id;
  const existing = db
    .prepare("SELECT 1 FROM kudos WHERE session_id = ? AND user_id = ?")
    .get(sessionId, req.userId);
  if (existing) {
    db.prepare("DELETE FROM kudos WHERE session_id = ? AND user_id = ?").run(sessionId, req.userId);
  } else {
    db.prepare("INSERT INTO kudos (session_id, user_id, at) VALUES (?, ?, ?)").run(
      sessionId,
      req.userId,
      Date.now()
    );
  }
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow;
  res.json(sessionToApi(row));
});

app.post("/api/sessions/:id/comments", requireAuth, (req: AuthedRequest, res) => {
  const text = String(req.body?.text ?? "").trim().slice(0, 400);
  if (!text) return res.status(400).json({ error: "empty comment" });
  db.prepare("INSERT INTO comments (id, session_id, user_id, text, at) VALUES (?, ?, ?, ?, ?)").run(
    uid(),
    req.params.id,
    req.userId,
    text,
    Date.now()
  );
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as SessionRow;
  res.json(sessionToApi(row));
});

// ---------- people ----------

app.get("/api/users", requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare("SELECT * FROM users WHERE id != ? ORDER BY is_bot DESC, created_at")
    .all(req.userId) as UserRow[];
  res.json(
    rows.map((u) => ({
      ...publicUser(u),
      following: isFollowing(req.userId!, u.id),
      minutesThisWeek: minutesThisWeek(u.id),
    }))
  );
});

app.post("/api/users/:id/follow", requireAuth, (req: AuthedRequest, res) => {
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "no such user" });
  if (req.body?.follow) {
    db.prepare("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)").run(
      req.userId,
      req.params.id
    );
  } else {
    db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(
      req.userId,
      req.params.id
    );
  }
  res.json({ ok: true });
});

app.get("/api/leaderboard", requireAuth, (req: AuthedRequest, res) => {
  const ids = [
    req.userId!,
    ...(
      db.prepare("SELECT followee_id AS id FROM follows WHERE follower_id = ?").all(req.userId) as {
        id: string;
      }[]
    ).map((r) => r.id),
  ];
  const rows = ids
    .map((id) => {
      const u = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
      if (!u) return null;
      return { userId: u.id, name: u.name, emoji: u.emoji, minutes: minutesThisWeek(u.id) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.minutes - a.minutes);
  res.json(rows);
});

// ---------- boot ----------

ensureBots();
backfillReactions();
seedBotActivity().then(() => {
  app.listen(PORT, () => {
    console.log(`[woodshed] API listening on http://localhost:${PORT}`);
  });
});
