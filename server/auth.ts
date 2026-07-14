import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, UserRow } from "./db.ts";

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expected: string): boolean {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"));
}

export function issueToken(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    Date.now()
  );
  return token;
}

export interface AuthedRequest extends Request {
  userId?: string;
  user?: UserRow;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  const row = db.prepare("SELECT user_id FROM tokens WHERE token = ?").get(token) as
    | { user_id: string }
    | undefined;
  if (!row) return res.status(401).json({ error: "invalid token" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id) as
    | UserRow
    | undefined;
  if (!user) return res.status(401).json({ error: "unknown user" });
  req.userId = user.id;
  req.user = user;
  next();
}
