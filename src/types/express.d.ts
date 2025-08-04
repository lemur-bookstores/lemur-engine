import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      aiRequest?: boolean;
      requestStart?: number;
    }
  }
}
