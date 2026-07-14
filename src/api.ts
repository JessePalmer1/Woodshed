import {
  DiscoverUser,
  FeedSession,
  LeaderRow,
  MeUser,
  Piece,
  PieceStatus,
  SharePayload,
} from "./types";

const TOKEN_KEY = "woodshed:token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export interface MeResponse {
  user: MeUser;
  pieces: Piece[];
  sessions: FeedSession[];
}

export const api = {
  register: (payload: {
    name: string;
    handle: string;
    password: string;
    instrument: string;
    emoji: string;
    weeklyGoalMin: number;
    pieces: string[];
  }) => request<{ token: string; user: MeUser }>("/api/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  login: (handle: string, password: string) =>
    request<{ token: string; user: MeUser }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ handle, password }),
    }),

  me: () => request<MeResponse>("/api/me"),

  setGoal: (weeklyGoalMin: number) =>
    request<{ ok: true }>("/api/me", { method: "PATCH", body: JSON.stringify({ weeklyGoalMin }) }),

  addPiece: (title: string) =>
    request<{ ok: true }>("/api/pieces", { method: "POST", body: JSON.stringify({ title }) }),

  setPieceStatus: (id: string, status: PieceStatus) =>
    request<{ ok: true }>(`/api/pieces/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  feed: () => request<FeedSession[]>("/api/feed"),

  postSession: (payload: SharePayload) =>
    request<FeedSession>("/api/sessions", { method: "POST", body: JSON.stringify(payload) }),

  toggleKudos: (sessionId: string) =>
    request<FeedSession>(`/api/sessions/${sessionId}/kudos`, { method: "POST" }),

  addComment: (sessionId: string, text: string) =>
    request<FeedSession>(`/api/sessions/${sessionId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  users: () => request<DiscoverUser[]>("/api/users"),

  setFollow: (userId: string, follow: boolean) =>
    request<{ ok: true }>(`/api/users/${userId}/follow`, {
      method: "POST",
      body: JSON.stringify({ follow }),
    }),

  leaderboard: () => request<LeaderRow[]>("/api/leaderboard"),
};

/** Encode a Blob to base64 (for the session clip upload). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
