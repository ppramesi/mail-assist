import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import _ from "lodash";
import logger from "../logger/bunyan.js";
import { Database } from "../databases/base.js";

export function buildAuthMiddleware(database: Database) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    req.body.fromAccessToken = false;
    const accessToken = req.header("x-access-token");
    const sessionToken = req.header("x-session-token");

    if (!process.env.TOKEN_KEY) {
      logger.error("Token key not set.");
      res.status(500).send("Token key not set");
      return;
    }

    if (!accessToken && !sessionToken) {
      logger.warn("Unauthorized access attempt detected.");
      res.status(403).send("Who the fuck are you?");
      return;
    }
    if (accessToken) {
      try {
        const decoded = jwt.verify(
          accessToken,
          process.env.TOKEN_KEY!,
        ) as jwt.JwtPayload;
        if (decoded && _.isObject(decoded)) {
          Object.entries(decoded).forEach(([key, value]) => {
            req.body[key] = value;
          });
          logger.info(
            `Token successfully verified for user with details: ${JSON.stringify(
              decoded,
            )}`,
          );
        }
        req.body.fromAccessToken = true;
        next();
      } catch (err) {
        logger.error("Failed to verify token:", err);
        res.status(403).send("Who the fuck are you?");
        return;
      }
    } else if (sessionToken) {
      if (req.body["user_id"]) {
        logger.error("What the fuck are you doing???");
        res.status(403).send("What the fuck are you doing?!?!?!");
        return;
      }
      const user = await database.getUserBySessionKey(sessionToken);
      if (!user) {
        logger.error("Failed to find session token:");
        res.status(403).send("Who the fuck are you?");
        return;
      }

      try {
        const { email, metakey } = user!;
        const decoded = jwt.verify(
          sessionToken,
          process.env.TOKEN_KEY! + metakey,
        ) as jwt.JwtPayload;

        if (decoded && _.isObject(decoded)) {
          Object.entries(decoded).forEach(([key, value]) => {
            req.body[key] = value;
          });
          logger.info(
            `Token successfully verified for user with details: ${JSON.stringify(
              decoded,
            )}`,
          );
        }

        if (!req.body["user_id"]) {
          logger.error("Malformed jwt!!!");
          res.status(403).send("Malformed jwt!!!!?!");
          return;
        }

        if (email === decoded.email) {
          next();
        } else {
          logger.error("Failed to verify token: email mismatch");
          res.status(403).send("Who the fuck are you?");
          return;
        }
      } catch (err) {
        logger.error("Failed to verify token:", err);
        res.status(403).send("Who the fuck are you?");
        return;
      }
    } else {
      logger.warn("Unauthorized access attempt detected.");
      res.status(403).send("Who the fuck are you?");
      return;
    }
  };
}
