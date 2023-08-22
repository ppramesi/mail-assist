import { Request, Response, NextFunction } from "express";
import _ from "lodash";
import logger from "../logger/bunyan.js";
import { Authenticator } from "../authentication/base.js";

export function buildAuthMiddleware(authenticator: Authenticator) {
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
        const verified = await authenticator.verifyAdminToken(
          adminToken,
          req.body,
        );
        if (verified.status === "ok") {
          req.body.fromAccessToken = true;
          next();
        } else {
          logger.error("Failed to verify token:", verified);
          res.status(403).send("Who the fuck are you?");
          return;
        }
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

      try {
        const verified = await authenticator.verifySessionToken(
          sessionToken,
          req.body,
        );
        if (verified.status === "ok") {
          next();
        } else {
          logger.error("Failed to verify token:", verified);
          res.status(403).send("Who the fuck are you?");
          return;
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
