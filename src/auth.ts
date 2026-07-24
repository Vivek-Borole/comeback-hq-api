import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { pool } from "./db";
import { asyncHandler } from "./util";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Generate one and add it to your environment.");
}
const TOKEN_TTL = "30d"; // long-lived: this is a personal single-user tracker

const credsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

function signToken(userId: number, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET as string, { expiresIn: TOKEN_TTL });
}

export const authRouter = Router();

// POST /auth/signup  { email, password } -> { token, email }
authRouter.post(
  "/signup",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid email and a password of at least 8 characters." });
    }
    const email = parsed.data.email.toLowerCase();

    try {
      const hash = await bcrypt.hash(parsed.data.password, 10);
      const inserted = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email, hash]
      );
      const userId: number = inserted.rows[0].id;
      await pool.query("INSERT INTO user_state (user_id, data) VALUES ($1, '{}'::jsonb)", [userId]);
      return res.status(201).json({ token: signToken(userId, email), email });
    } catch (err: any) {
      if (err && err.code === "23505") {
        return res.status(409).json({ error: "An account with that email already exists." });
      }
      throw err;
    }
  })
);

// POST /auth/login  { email, password } -> { token, email }
authRouter.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid email and password." });
    }
    const email = parsed.data.email.toLowerCase();

    const found = await pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email]);
    const user = found.rows[0];
    // Same generic message whether the email is unknown or the password is wrong.
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    return res.json({ token: signToken(user.id, email), email });
  })
);

export interface AuthedRequest extends Request {
  userId?: number;
}

/** Middleware: require a valid Bearer JWT; attaches req.userId. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      res.status(401).json({ error: "Invalid session. Please log in again." });
      return;
    }
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}
