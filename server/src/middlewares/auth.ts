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
    const adminToken = req.header("x-admin-token");
    const sessionToken = req.header("x-session-token");

    if (!adminToken && !sessionToken) {
      logger.warn("Unauthorized admin attempt detected.");
      res.status(403).send("Who the fuck are you?");
      return;
    }
    if (adminToken) {
      if (!process.env.ADMIN_KEY) {
        logger.error("Token key not set.");
        res.status(500).send("Token key not set");
        return;
      }
      try {
        const decoded = jwt.verify(
          adminToken,
          process.env.ADMIN_KEY!,
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
      if (!process.env.TOKEN_KEY) {
        logger.error("Token key not set.");
        res.status(500).send("Token key not set");
        return;
      }

      if (req.body["user_id"]) {
        logger.error("What the fuck are you doing???");
        res.status(403).send("What the fuck are you doing?!?!?!");
        return;
      }

      const unverifiedDecoded = jwt.decode(sessionToken);
      if (!unverifiedDecoded || typeof unverifiedDecoded === "string") {
        logger.error(`Malformed JWT: ${JSON.stringify(unverifiedDecoded)}`);
        res
          .status(403)
          .send(`Malformed JWT: ${JSON.stringify(unverifiedDecoded)}`);
        return;
      }

      if (
        !unverifiedDecoded.exp ||
        unverifiedDecoded.exp < new Date().getTime() / 1000
      ) {
        logger.error(`Expired JWT: ${JSON.stringify(unverifiedDecoded)}`);
        res
          .status(403)
          .send(`Expired JWT: ${JSON.stringify(unverifiedDecoded)}`);
        return;
      }

      const user = await database.getUserByEmail(unverifiedDecoded.email);
      if (!user) {
        logger.error("Failed to find session token:");
        res.status(403).send("Who the fuck are you?");
        return;
      }

      try {
        const decoded = jwt.verify(
          sessionToken,
          process.env.TOKEN_KEY,
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

        next();
      } catch (err) {
        logger.error("Failed to verify token:", err);
        res.status(403).send("Who the fuck are you?");
        return;
      }
    } else {
      logger.warn("Unauthorized admin attempt detected.");
      res.status(403).send("Who the fuck are you?");
      return;
    }
  };
}
