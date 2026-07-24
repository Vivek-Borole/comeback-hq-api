import { RequestHandler, Response, NextFunction } from "express";

/**
 * Wraps an async route handler so any rejected promise is forwarded to
 * Express's error middleware instead of crashing / hanging the request.
 * (Express 4 does not catch async errors on its own.)
 */
export const asyncHandler =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
