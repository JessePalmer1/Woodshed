import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, ApiError, blobToBase64, getToken, setToken } from "./api";
import {
  DiscoverUser,
  FeedSession,
  LeaderRow,
  MeUser,
  Piece,
  PieceStatus,
  SharePayload,
} from "./types";
import { dayKey, dayStart, weekStart } from "./utils";

export interface StoreState {
  booting: boolean;
  me: MeUser | null;
  pieces: Piece[];
  mySessions: FeedSession[];
  feed: FeedSession[];
  users: DiscoverUser[];
  leaderboard: LeaderRow[];
}

interface StoreApi {
  state: StoreState;
  login: (handle: string, password: string) => Promise<void>;
  register: (payload: Parameters<typeof api.register>[0]) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  share: (payload: Omit<SharePayload, "clipWavBase64">, clipBlob: Blob | null) => Promise<void>;
  toggleKudos: (sessionId: string) => Promise<void>;
  addComment: (sessionId: string, text: string) => Promise<void>;
  addPiece: (title: string) => Promise<void>;
  setPieceStatus: (id: string, status: PieceStatus) => Promise<void>;
  setGoal: (minutes: number) => Promise<void>;
  setFollow: (userId: string, follow: boolean) => Promise<void>;
}

const Ctx = createContext<StoreApi | null>(null);

const EMPTY: StoreState = {
  booting: true,
  me: null,
  pieces: [],
  mySessions: [],
  feed: [],
  users: [],
  leaderboard: [],
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(EMPTY);
  const pollRef = useRef(0);

  const refresh = useCallback(async () => {
    const [me, feed, users, leaderboard] = await Promise.all([
      api.me(),
      api.feed(),
      api.users(),
      api.leaderboard(),
    ]);
    setState({
      booting: false,
      me: me.user,
      pieces: me.pieces,
      mySessions: me.sessions,
      feed,
      users,
      leaderboard,
    });
  }, []);

  const handleAuthFailure = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setToken(null);
      setState({ ...EMPTY, booting: false });
    }
  }, []);

  // boot: try the stored token
  useEffect(() => {
    if (!getToken()) {
      setState((s) => ({ ...s, booting: false }));
      return;
    }
    refresh().catch((e) => {
      handleAuthFailure(e);
      setState((s) => ({ ...s, booting: false }));
    });
  }, [refresh, handleAuthFailure]);

  // poll while signed in so bot reactions and new posts appear live
  useEffect(() => {
    if (!state.me) return;
    pollRef.current = window.setInterval(() => {
      refresh().catch(handleAuthFailure);
    }, 12000);
    return () => window.clearInterval(pollRef.current);
  }, [state.me?.id, refresh, handleAuthFailure]);

  const applySessionUpdate = useCallback((session: FeedSession) => {
    const replace = (list: FeedSession[]) =>
      list.map((s) => (s.id === session.id ? session : s));
    setState((s) => ({ ...s, feed: replace(s.feed), mySessions: replace(s.mySessions) }));
  }, []);

  const value = useMemo<StoreApi>(
    () => ({
      state,
      login: async (handle, password) => {
        const { token } = await api.login(handle, password);
        setToken(token);
        await refresh();
      },
      register: async (payload) => {
        const { token } = await api.register(payload);
        setToken(token);
        await refresh();
      },
      logout: () => {
        setToken(null);
        setState({ ...EMPTY, booting: false });
      },
      refresh,
      share: async (payload, clipBlob) => {
        const clipWavBase64 = clipBlob ? await blobToBase64(clipBlob) : "";
        const session = await api.postSession({ ...payload, clipWavBase64 });
        setState((s) => ({
          ...s,
          feed: [session, ...s.feed],
          mySessions: [session, ...s.mySessions],
        }));
      },
      toggleKudos: async (sessionId) => {
        applySessionUpdate(await api.toggleKudos(sessionId));
      },
      addComment: async (sessionId, text) => {
        applySessionUpdate(await api.addComment(sessionId, text));
      },
      addPiece: async (title) => {
        await api.addPiece(title);
        const me = await api.me();
        setState((s) => ({ ...s, pieces: me.pieces }));
      },
      setPieceStatus: async (id, status) => {
        setState((s) => ({
          ...s,
          pieces: s.pieces.map((p) => (p.id === id ? { ...p, status } : p)),
        }));
        await api.setPieceStatus(id, status);
      },
      setGoal: async (minutes) => {
        setState((s) => (s.me ? { ...s, me: { ...s.me, weeklyGoalMin: minutes } } : s));
        await api.setGoal(minutes);
      },
      setFollow: async (userId, follow) => {
        setState((s) => ({
          ...s,
          users: s.users.map((u) => (u.id === userId ? { ...u, following: follow } : u)),
        }));
        await api.setFollow(userId, follow);
        await refresh();
      },
    }),
    [state, refresh, applySessionUpdate]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

// ---------- derived stats (over my sessions) ----------

/** Consecutive practice days ending today or yesterday. */
export function streakDays(sessions: FeedSession[]): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)));
  if (days.size === 0) return 0;
  let offset = days.has(dayKey(Date.now())) ? 0 : -1;
  if (offset === -1 && !days.has(dayKey(dayStart(-1) + 1000))) return 0;
  let streak = 0;
  while (days.has(dayKey(dayStart(offset) + 1000))) {
    streak++;
    offset--;
  }
  return streak;
}

export function minutesThisWeek(sessions: FeedSession[]): number {
  const ws = weekStart();
  return Math.round(
    sessions
      .filter((s) => s.startedAt >= ws)
      .reduce((acc, s) => acc + s.analysis.durationSec / 60, 0)
  );
}

/** Minutes practiced per day for the last 7 days (oldest first). */
export function last7Days(sessions: FeedSession[]): { label: string; minutes: number }[] {
  const out: { label: string; minutes: number }[] = [];
  for (let i = -6; i <= 0; i++) {
    const start = dayStart(i);
    const end = start + 24 * 3600_000;
    const minutes = Math.round(
      sessions
        .filter((s) => s.startedAt >= start && s.startedAt < end)
        .reduce((acc, s) => acc + s.analysis.durationSec / 60, 0)
    );
    out.push({
      label: new Date(start).toLocaleDateString(undefined, { weekday: "narrow" }),
      minutes,
    });
  }
  return out;
}

export function totals(sessions: FeedSession[]): { sessions: number; hours: number } {
  const sec = sessions.reduce((a, s) => a + s.analysis.durationSec, 0);
  return { sessions: sessions.length, hours: Math.round((sec / 3600) * 10) / 10 };
}
