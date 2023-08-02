import express, { Request } from "express";
import { Database, ChatHistory, Message } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";

export function buildChatHistoryRoutes(db: Database) {
  const router = express.Router();

  router.get("/email/:emailId", async (req, res) => {
    const { emailId } = req.params;
    try {
      const chatHistory = await db.getChatHistoryByEmail(emailId);
      logger.info(`Fetched chat history by email ID: ${emailId}`);
      res.status(200).send({ chat_history: chatHistory });
    } catch (error) {
      logger.error(
        `Failed to fetch chat history by email ID: ${emailId}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.get("/reply/:replyId", async (req, res) => {
    const { replyId } = req.params;
    try {
      const chatHistory = await db.getChatHistoryByReply(replyId);
      logger.info(`Fetched chat history by reply ID: ${replyId}`);
      res.status(200).send({ chat_history: chatHistory });
    } catch (error) {
      logger.error(
        `Failed to fetch chat history by reply ID: ${replyId}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.put(
    "/:id",
    async (req: Request<{ id: string }, {}, { chat: Message[] }>, res) => {
      const { body } = req;
      const { id } = req.params;
      try {
        await db.appendChatHistory(id, body.chat);
        logger.info(`Appended messages to chat history ID: ${id}`);
        res.status(200).send({ status: "ok" });
      } catch (error) {
        logger.error(`Failed to append to chat history by ID: ${id}`, error);
        res.status(500).send(JSON.stringify(error));
      }
    },
  );

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const chatHistory = await db.getChatHistoryById(id);
      logger.info(`Fetched chat history by ID: ${id}`);
      res.status(200).send({ chat_history: chatHistory });
    } catch (error) {
      logger.error(`Failed to fetch chat history by ID: ${id}`, error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.post("/", async (req: Request<{}, {}, ChatHistory>, res) => {
    const { body } = req;
    try {
      await db.insertChatHistory(body);
      logger.info(`Inserted new chat history: ${JSON.stringify(body)}`);
      res.status(200).send({ status: "ok" });
    } catch (error) {
      logger.error("Failed to insert chat history:", error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.get("/", async (_, res) => {
    try {
      const chatHistory = await db.getChatHistory();
      logger.info(`Fetched all chat histories`);
      res.status(200).send({ chat_history: chatHistory });
    } catch (error) {
      logger.error("Failed to fetch all chat histories:", error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  return router;
}
