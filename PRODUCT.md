# Woodshed — Product & Design Document

**Tagline:** *Practice out loud.*

Woodshed is a social practice tracker for musicians. You tap once, play, and the app
listens — it figures out how long you played, what key and tempo you were in, picks the
best 12 seconds of the session, and drafts a post your friends can react to. Strava's
"the activity logs itself, then you share it" loop, applied to the practice room.

---

## 1. Product principles

1. **Zero-friction capture is the product.** Every practice journal dies because logging
   is homework. In Woodshed the session logs itself; posting costs one tap.
2. **Describe content confidently, identify songs cautiously.** On-device analysis
   states what it can measure (duration, key, tempo, note density) and matches against
   the user's *declared repertoire* — it never bets the UX on blind song recognition.
3. **The clip is the star.** A timer screenshot is boring; twelve seconds of you actually
   playing — auto-selected so you don't have to scrub — is a post people want to open.
4. **Privacy first, visibly.** Recording is an explicit, on-screen session (never covert),
   analysis runs on-device, and every post has a visibility control (Private / Friends /
   Public). Private sessions still count toward streaks and stats.
5. **Supportive, not competitive.** Kudos and streaks, yes; public shame, no. The
   leaderboard is a friendly weekly tally, not a ranking ladder.

## 2. Target user & positioning

- **Primary:** adult learners and serious students (piano, guitar, strings, winds) who
  already *want* a practice habit and lack accountability.
- **Wedge communities:** university music schools, teacher studios, instrument
  subreddits/Discords. The teacher angle (assign pieces, see real practice) is the v2
  distribution multiplier.
- **Positioning:** "Strava for the woodshed." No existing tracker (Modacity, Andante,
  Instrumentive) has a real social layer; no social app has zero-friction capture.

## 3. The core loop

```
 Tap ▶  →  Play (screen can lock; explicit session)  →  Tap ■
   →  On-device analysis: duration, active time, key, tempo, note density,
      best-clip selection
   →  Auto-drafted post: caption + stat chips + 12s clip + piece tags
   →  One tap to share  →  kudos & comments  →  streak grows
```

The hook is step 3→4: the session turns itself into something worth sharing.

## 4. Feature set (this POC)

### Capture & analysis (real, on-device)
- One-tap session recording via the microphone (Web Audio / MediaRecorder).
- Live level meter + elapsed timer while recording.
- Post-session analysis, all in the browser:
  - **Duration & active time** (silence-trimmed via adaptive RMS gating).
  - **Key detection** — pitch tracking (normalized autocorrelation / NSDF) → pitch-class
    histogram → Krumhansl–Schmuckler key-profile correlation, with a confidence score.
  - **Tempo estimation** — onset-strength envelope → autocorrelation over 55–190 BPM
    with octave-error correction.
  - **Note density** (notes/min) as a texture stat.
  - **Auto-clip** — sliding 12-second window scored by energy × pitch clarity ×
    non-silence; best window is extracted, waveform peaks precomputed for display.
- Sessions under ~5s are rejected gracefully.

### Post drafting
- Auto-written caption from the analysis (editable).
- Stat chips: duration, key, tempo, notes/min.
- Piece tagging from the user's **repertoire shelf** (declared pieces — the reliable
  alternative to song ID), plus add-a-piece inline.
- Visibility control per post: Private / Friends / Public (default Friends).

### Social layer
- **Feed** of sessions from you and the people you follow, each with clip, chips,
  caption, kudos, comments.
- **Kudos** (👏) and threaded comments.
- **Profile**: streak, weekly goal ring, 7-day practice chart, all-time totals,
  repertoire shelf (Working on / Mastered).
- **Piece progress timeline** — every clip you've posted of a piece, oldest → newest:
  *hear* week 1 vs. week 6. Unique content no other app produces.
- **Weekly leaderboard** among friends (minutes this week).
- **Exportable share card** — a 1080×1080 PNG of any of your sessions (stats + waveform),
  the off-platform viral unit for Instagram/TikTok.

### v1: the real social core (shipped)
- **Accounts & auth** — register/login with handle + password (scrypt-hashed), token
  sessions. Express 5 + Node's built-in SQLite; zero native dependencies.
- **Real feed** — sessions, kudos, comments, and the follow graph live server-side;
  multiple people on the same server see each other's posts (visibility rules
  enforced per post: private / followers / public).
- **Clip uploads** — the auto-picked 12s WAV is uploaded on share and streamed back
  to the feed; *analysis still runs 100% on-device*, and only the clip leaves the
  browser.
- **The house band** — the five seeded musicians moved server-side: they have real
  accounts (bot-flagged), post sessions with synthesized clips, keep the feed fresh
  between visits, auto-follow every new user, and react to human posts on short
  timers (with a boot-time backfill so restarts don't lose reactions). Every new
  user lands in a feed that's already alive — the cold-start answer, productized.
- **People screen** — discover and follow everyone on the server.

### POC simulation choices that remain (honest fakes)
- The house band's clips are synthesized (additive-synthesis arpeggio/scale passages
  matching each post's stated key & tempo), and their reactions arrive on timers.
- **Demo session** button (on the record screen) synthesizes a practice session for
  people evaluating the app without an instrument handy — clearly badged as a demo.

## 5. Explicitly out of scope so far (v2+)

- Hosted deployment, e-mail verification, push notifications.
- Blind song identification (kept out by design — repertoire matching is the spine).
- Practice-type auto-tagging (scales vs. repertoire vs. improv) — feasible, v2.
- Teacher/studio tools, assignments.
- Native apps (the analysis pipeline is portable; iOS/Android would use the same
  explicit-foreground-session model Strava uses).

## 6. Design language

- **Warm workshop dark theme** — near-black walnut background, amber lamplight accent
  (#f0a24a), cream text. Feels like a practice room at night, not a fitness dashboard.
- Mobile-first single column (~430px), bottom tab bar with an oversized center record
  button. Desktop shows the same column, centered.
- The shed-with-a-note logomark; lowercase "woodshed" logotype.
- Microcopy speaks musician: "in the shed", "kudos", "shedding".

## 7. Roadmap status

- **v0 — prove the magic:** ✅ shipped (capture → analysis → auto-draft → share).
- **v1 — the social core:** ✅ shipped (accounts, follow, real feed, kudos/comments,
  server-side seed community).
- **v2 — depth & stickiness (next):** teacher/studio tools, practice-type tagging,
  hosted deployment, richer piece progress (compare two clips side by side), weekly
  recap posts, exportable video clip cards.

## 8. Success criteria for the POC demo

1. Record yourself playing (or run a demo session) → the drafted post's key/tempo/clip
   feel accurate enough that you'd share it un-edited. **This is the magic moment.**
2. The feed feels alive: friends' sessions with playable clips, reactions arriving on
   your post within a minute of sharing.
3. Streak/goal/leaderboard update correctly across days.
4. A piece's progress timeline plays clips oldest → newest.
5. Share card exports as a clean PNG.
