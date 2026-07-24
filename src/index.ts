import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initSchema } from "./db";
import { authRouter } from "./auth";
import { stateRouter } from "./state";

const app = express();

app.use(helmet());
app.use(express.json({ limit: "2mb" })); // the whole state blob is small, but leave headroom

// CORS: only allow the browser origins we trust (frontend + localhost).
const origins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

// Health check (also handy for keeping the free host warm via an uptime pinger).
app.get("/health", (_req, res) => res.json({ ok: true }));

// Throttle auth attempts to slow down brute force.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

app.use("/auth", authLimiter, authRouter);
app.use("/state", stateRouter);

// Centralized error handler (async handlers forward here via asyncHandler).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;

initSchema()
  .then(() => {
    app.listen(port, () => console.log(`Comeback HQ API listening on port ${port}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  });
