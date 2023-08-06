import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import { Context, PolicyResult } from "../../schema/index.js";
import { Authorization } from "../../authorization/base.js";

export function buildContextRoutes(db: Database, authorizer?: Authorization) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if (authorizer) {
      const { body, params } = req;
      const { user_id: userId } = body;
      if (userId) {
        const policies = await authorizer.getContextPolicies(userId, {
          body,
          params,
          fromAccessToken: body.fromAccessToken,
        });
        body.policies = policies;
        next();
      } else {
        logger.error("Failed contexts request: Unauthorized empty user");
        res
          .status(403)
          .send({ error: "Failed contexts request: Unauthorized empty user" });
        return;
      }
    } else {
      next();
    }
  });

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.readAllowed) {
        logger.error("Failed to get context: Unauthorized!");
        res
          .status(500)
          .send(
            JSON.stringify({ error: "Failed to get context: Unauthorized!" }),
          );
        return;
      }
      const ctx = await db.getContextById(id);
      if (!ctx) {
        throw new Error("Context not found");
      }
      const key = Object.keys(ctx)[0];
      const value = Object.values(ctx)[0];
      logger.info(`Fetched specific context value by key: ${key}`);
      res.status(200).send({ [key]: value });
      return;
    } catch (error) {
      logger.error(
        `Failed to fetch specific context value by id: ${id}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.post(
    "/:id",
    async (
      req: Request<
        { id: string },
        {},
        { key: string; value: string; policies: PolicyResult }
      >,
      res,
    ) => {
      const { value, key, policies } = req.body;
      const { id } = req.params;
      try {
        if (!policies.updateAllowed) {
          logger.error("Failed to update context: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to update context: Unauthorized!",
            }),
          );
          return;
        }
        await db.setContextValue(id, key, value);
        logger.info(
          `Set single context key-value pair, ID: ${id}, key: ${key}, value: ${value}`,
        );
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error(
          `Failed to set single context key-value pair, ID: ${id}, key: ${key}`,
          error,
        );
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.delete("/:id", async (req: Request<{ id: string }>, res) => {
    const { id } = req.params;
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.deleteAllowed) {
        logger.error("Failed to delete context: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to delete context: Unauthorized!",
          }),
        );
        return;
      }
      await db.deleteContext(id);
      logger.info(`Deleted context by ID: ${id}`);
      res.status(200).send({ status: "ok" });
      return;
    } catch (error) {
      logger.error(`Failed to delete context by ID: ${id}`, error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.post(
    "/",
    async (
      req: Request<{}, {}, { context: Context; policies: PolicyResult }>,
      res,
    ) => {
      const { body } = req;
      try {
        const { policies, context } = body;
        if (!policies.createAllowed) {
          logger.error("Failed to insert context: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to insert context: Unauthorized!",
            }),
          );
          return;
        }
        await db.insertContext(context);
        logger.info(
          `Set multiple context key-value pairs: ${JSON.stringify(body)}`,
        );
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error("Failed to set multiple context key-value pairs:", error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.get("/", async (req, res) => {
    try {
      const {
        body: { policies, user_id: userId },
      } = req;
      if (!policies.readAllAllowed && !userId) {
        logger.error("Failed to get context: Unauthorized!");
        res
          .status(500)
          .send(
            JSON.stringify({ error: "Failed to get context: Unauthorized!" }),
          );
        return;
      }
      const context = await db.getContext(userId);
      logger.info(`Fetched the whole context`);
      res.status(200).send({ context });
      return;
    } catch (error) {
      logger.error("Failed to fetch the whole context:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  return router;
}
