import express, { Request } from "express";
import { Database, PotentialReplyEmail } from "../../databases/base";
import logger from "../../logger/bunyan";

export function buildReplyRoutes(db: Database) {
  const router = express.Router();

  router.get("/email/:emailId", async (req, res) => {
    const { emailId } = req.params;
    try {
      const replies = await db.getPotentialRepliesByEmail(emailId);
      logger.info(`Fetched potential replies by email id: ${emailId}`);
      res.status(200).send(replies);
    } catch (error) {
      logger.error(
        `Failed to fetch potential replies by email id: ${emailId}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const reply = await db.getPotentialReply(id);
      logger.info(`Fetched potential reply by id: ${id}`);
      res.status(200).send(reply);
    } catch (error) {
      logger.error(`Failed to fetch potential reply by id: ${id}`, error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.post("/:id", async (req: Request<{ id:string }, {}, { text: string }>, res) => {
    const { body, params: { id } } = req;
    try {
      const replyId = await db.updatePotentialReply(id, body.text);
      logger.info(
        `Updated potential reply: ${JSON.stringify(
          body,
        )}, reply id: ${replyId}`,
      );
      res.status(200).send({ status: "ok", replyId });
    } catch (error) {
      logger.error("Failed to update potential reply:", error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.post("/", async (req: Request<{}, {}, PotentialReplyEmail>, res) => {
    const { body } = req;
    try {
      const replyId = await db.insertPotentialReply(body);
      logger.info(
        `Inserted potential reply: ${JSON.stringify(
          body,
        )}, reply id: ${replyId}`,
      );
      res.status(200).send({ status: "ok", replyId });
    } catch (error) {
      logger.error("Failed to insert potential reply:", error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  return router;
}
