import express, { Request } from "express";
import { Database, Context } from "../../databases/base";
import logger from "../../logger/bunyan";

export function buildContextRoutes(db: Database) {
  const router = express.Router();

  router.get("/:key", async (req, res) => {
    const { key } = req.params;
    try {
      const value = await db.getContextValue(key);
      logger.info(`Fetched specific context value by key: ${key}`);
      res.status(200).send({ [key]: value });
    } catch (error) {
      logger.error(
        `Failed to fetch specific context value by key: ${key}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.post(
    "/:id",
    async (
      req: Request<{ id: string }, {}, { key: string; value: string }>,
      res,
    ) => {
      const { value, key } = req.body;
      const { id } = req.params;
      try {
        await db.setContextValue(id, key, value);
        logger.info(
          `Set single context key-value pair, ID: ${id}, key: ${key}, value: ${value}`,
        );
        res.status(200).send({ status: "ok" });
      } catch (error) {
        logger.error(
          `Failed to set single context key-value pair, ID: ${id}, key: ${key}`,
          error,
        );
        res.status(500).send(JSON.stringify(error));
      }
    },
  );

  router.post("/", async (req: Request<{}, {}, Context>, res) => {
    const { body } = req;
    try {
      await db.insertContext(body);
      logger.info(
        `Set multiple context key-value pairs: ${JSON.stringify(body)}`,
      );
      res.status(200).send({ status: "ok" });
    } catch (error) {
      logger.error("Failed to set multiple context key-value pairs:", error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.get("/", async (req, res) => {
    try {
      const context = await db.getContext();
      logger.info(`Fetched the whole context`);
      res.status(200).send(context);
    } catch (error) {
      logger.error("Failed to fetch the whole context:", error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  return router;
}
