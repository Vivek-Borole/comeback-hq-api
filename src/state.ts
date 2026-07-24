import { Router, Response } from "express";
import { pool } from "./db";
import { requireAuth, AuthedRequest } from "./auth";
import { asyncHandler } from "./util";

export const stateRouter = Router();

// GET /state -> { data, updatedAt }  (the whole saved app-state blob for this user)
stateRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await pool.query(
      "SELECT data, updated_at FROM user_state WHERE user_id = $1",
      [req.userId]
    );
    const row = result.rows[0];
    if (!row) return res.json({ data: null, updatedAt: null });
    return res.json({ data: row.data, updatedAt: new Date(row.updated_at).getTime() });
  })
);

// PUT /state  { data } -> { updatedAt }   (upsert; last write wins)
stateRouter.put(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const data = req.body?.data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return res.status(400).json({ error: "Body must include a 'data' object." });
    }
    const result = await pool.query(
      `INSERT INTO user_state (user_id, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING updated_at`,
      [req.userId, JSON.stringify(data)]
    );
    return res.json({ updatedAt: new Date(result.rows[0].updated_at).getTime() });
  })
);
