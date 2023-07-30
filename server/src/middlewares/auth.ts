import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { isObject } from "lodash";
import logger from "../logger/bunyan";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.header("x-access-token");

  if (!process.env.TOKEN_KEY) {
    logger.error("Token key not set.");
    return res.status(500).send("Token key not set");
  }

  if (!token) {
    logger.warn("Unauthorized access attempt detected.");
    return res.status(403).send("Who the fuck are you?");
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_KEY!) as jwt.JwtPayload;
    if (decoded && isObject(decoded)) {
      Object.entries(decoded).forEach(([key, value]) => {
        req.body[key] = value;
      });
      logger.info(
        `Token successfully verified for user with details: ${JSON.stringify(
          decoded,
        )}`,
      );
    }
    next();
  } catch (err) {
    logger.error("Failed to verify token:", err);
    res.status(403).send("Who the fuck are you?");
  }
}
