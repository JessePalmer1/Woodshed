# 🛖 Woodshed

*Practice out loud.* A social practice tracker for musicians — tap once, play, and
Woodshed listens: it measures your session, detects key and tempo, picks your best
12 seconds, and drafts a post your friends can cheer on. Strava for the practice room.

See **[PRODUCT.md](./PRODUCT.md)** for the full product & design document.

**Now at v1:** real accounts, a real feed served by an API, follow/followers, kudos and
comments that persist server-side — while all audio analysis still runs on-device.

## Run it

```bash
npm install
npm run dev
```

That starts both the API (Express + SQLite, port 3001) and the web client
(http://localhost:5173, Chrome/Edge recommended). Allow microphone access when you
start a session.

## Try the demo in 2 minutes

1. **Register** — name, handle, password, instrument, a couple of pieces, weekly goal.
   You're automatically introduced to the **house band**: five seeded musicians whose
   sessions (synthesized audio) keep the feed alive.
2. **Feed** — play their clips, give kudos, leave comments.
3. **Record** — hit the big amber button and play (or sing, whistle, hum) for 15+
   seconds, then stop. On-device analysis finds your key, tempo, and best moment.
   No instrument? Use **"Run a demo session"**.
4. **Share** — tweak the auto-drafted caption, tag a piece, choose visibility, post.
   The clip uploads to the server; kudos and a comment arrive within the minute.
5. **Profile** — streak, weekly goal, 7-day chart, repertoire shelf, leaderboard.
   Tap a piece to hear your progress timeline; export any session as a share-card PNG.
6. **Multi-user** — open an incognito window, register a second account, follow each
   other from the 👥 people screen, and watch posts and kudos flow between accounts.

## What's real vs. simulated (v1)

| Real | Simulated |
| --- | --- |
| Accounts, auth, follow graph, feed, kudos, comments (Express + SQLite) | The five "house band" musicians and their clips (server-side synth) |
| Mic capture, level meter, session timing | Their reactions to your posts (arrive on a timer) |
| Key detection (NSDF pitch → Krumhansl profiles) | "Demo session" stats |
| Tempo estimation (onset autocorrelation) | |
| Silence gating / active-time measurement | |
| Auto-clip selection, WAV upload, waveform | |
| Streaks, goals, stats, leaderboard, share-card export | |

Audio *analysis* never leaves the browser; only the 12-second clip you choose to post
is uploaded. Server data lives in `server/data/` (SQLite DB + WAV clips) — delete that
folder to reset the world.

## Stack

- **Client:** Vite + React + TypeScript. Hand-rolled DSP (`src/audio/analysis.ts`) —
  no audio libraries.
- **Server:** Express 5 + Node's built-in `node:sqlite` (zero native deps), token auth
  (scrypt), clips stored as WAV files on disk. The house band lives in
  `server/bots.ts` and shares the client's synthesizer (`src/audio/synth.ts`).
