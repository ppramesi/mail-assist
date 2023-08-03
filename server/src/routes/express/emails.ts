import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import { Email } from "../../adapters/base.js";
import logger from "../../logger/bunyan.js";

export function buildEmailRoutes(db: Database) {
  const router = express.Router();

  router.post(
    "/bulk",
    async (req: Request<{}, {}, { emails: Email[] }>, res) => {
      const { body } = req;
      try {
        await db.insertEmails(body.emails);
        logger.info(`Inserted multiple emails: ${JSON.stringify(body.emails)}`);
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error("Failed to insert multiple emails:", error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.put(
    "/:id",
    async (
      req: Request<{ id: string }, {}, { status: string; summary?: string }>,
      res,
    ) => {
      const { id } = req.params;
      const { status, summary } = req.body;
      try {
        await db.updateEmailProcessedData(id, status, summary);
        logger.info(
          `Updated specific email's status and summary, id: ${id}, status: ${status}, summary: ${summary}`,
        );
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error(
          `Failed to update specific email's status and summary, id: ${id}`,
          error,
        );
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const email = await db.getEmail(id);
      logger.info(`Fetched email by id: ${id}`);
      res.status(200).send({ email });
      return;
    } catch (error) {
      logger.error(`Failed to fetch email by id: ${id}`, error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.get("/", async (_, res) => {
    try {
      const emails = await db.getEmails();
      logger.info("Fetched all emails");
      res.status(200).send({ emails });
      return;
    } catch (error) {
      logger.error("Failed to fetch all emails:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.post("/", async (req: Request<{}, {}, Email>, res) => {
    const { body: email } = req;
    try {
      await db.insertEmail(email);
      logger.info(`Inserted single email: ${JSON.stringify(email)}`);
      res.status(200).send({ status: "ok" });
      return;
    } catch (error) {
      logger.error("Failed to insert single email:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  return router;
}
