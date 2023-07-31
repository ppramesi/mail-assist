import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { isObject } from "lodash";
import logger from "../logger/bunyan";
import { Database } from "../databases/base";

export function buildAuthMiddleware(database: Database) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const accessToken = req.header("x-access-token");
    const sessionToken = req.header("x-session-token");

    if (!process.env.TOKEN_KEY) {
      logger.error("Token key not set.");
      res.status(500).send("Token key not set");
    }

    if (!accessToken && !sessionToken) {
      logger.warn("Unauthorized access attempt detected.");
      res.status(403).send("Who the fuck are you?");
    }
    if (accessToken) {
      try {
        const decoded = jwt.verify(
          accessToken,
          process.env.TOKEN_KEY!,
        ) as jwt.JwtPayload;
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
    } else if (sessionToken) {
      const user = await database.getUserBySessionKey(sessionToken);
      if (!user) {
        logger.error("Failed to find session token:");
        res.status(403).send("Who the fuck are you?");
      }

      try {
        const { email, metakey } = user!;
        const decoded = jwt.verify(
          sessionToken,
          process.env.TOKEN_KEY! + metakey,
        ) as jwt.JwtPayload;
        if (email === decoded.email) {
          next();
        } else {
          logger.error("Failed to verify token: email mismatch");
          res.status(403).send("Who the fuck are you?");
        }
      } catch (err) {
        logger.error("Failed to verify token:", err);
        res.status(403).send("Who the fuck are you?");
      }
    } else {
      logger.warn("Unauthorized access attempt detected.");
      res.status(403).send("Who the fuck are you?");
    }
  };
}
