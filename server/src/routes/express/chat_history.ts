import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import { ChatHistory, Message, PolicyResult } from "../../schema/index.js";
import { Authorization } from "../../authorization/base.js";

export function buildChatHistoryRoutes(
  db: Database,
  authorizer?: Authorization,
) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if (authorizer) {
      const { body, params } = req;
      const { user_id: userId } = body;
      if (userId) {
        const policies = await authorizer.getChatHistoryPolicies(userId, {
          body,
          params,
          fromAccessToken: body.fromAccessToken,
        });
        body.policies = policies;
        next();
      } else {
        logger.error("Failed chat history request: Unauthorized empty user");
        res.status(403).send({
          error: "Failed chat history request: Unauthorized empty user",
        });
        return;
      }
    } else {
      next();
    }
  });

  router.get("/email/:emailId", async (req, res) => {
    const { emailId } = req.params;
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.readAllowed) {
        logger.error("Failed to get chat history by email: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to get chat history by email: Unauthorized!",
          }),
        );
        return;
      }
      const chatHistory = await db.getChatHistoryByEmail(emailId);
      logger.info(`Fetched chat history by email ID: ${emailId}`);
      res.status(200).send({ chat_history: chatHistory });
      return;
    } catch (error) {
      logger.error(
        `Failed to fetch chat history by email ID: ${emailId}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.get("/reply/:replyId", async (req, res) => {
    const { replyId } = req.params;
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.readAllowed) {
        logger.error("Failed to get chat history by reply: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to get chat history by reply: Unauthorized!",
          }),
        );
        return;
      }
      const chatHistory = await db.getChatHistoryByReply(replyId);
      logger.info(`Fetched chat history by reply ID: ${replyId}`);
      res.status(200).send({ chat_history: chatHistory });
      return;
    } catch (error) {
      logger.error(
        `Failed to fetch chat history by reply ID: ${replyId}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.put(
    "/:id",
    async (
      req: Request<
        { id: string },
        {},
        { chat: Message[]; policies: PolicyResult }
      >,
      res,
    ) => {
      const { body } = req;
      const { id } = req.params;
      try {
        const { policies } = body;
        if (!policies.updateAllowed) {
          logger.error("Failed to update chat history: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to update chat history: Unauthorized!",
            }),
          );
          return;
        }
        await db.appendChatHistory(id, body.chat);
        logger.info(`Appended messages to chat history ID: ${id}`);
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error(`Failed to append to chat history by ID: ${id}`, error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.readAllowed) {
        logger.error("Failed to get chat history: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to get chat history: Unauthorized!",
          }),
        );
        return;
      }
      const chatHistory = await db.getChatHistoryById(id);
      logger.info(`Fetched chat history by ID: ${id}`);
      res.status(200).send({ chat_history: chatHistory });
      return;
    } catch (error) {
      logger.error(`Failed to fetch chat history by ID: ${id}`, error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.post(
    "/",
    async (
      req: Request<
        {},
        {},
        { chat_history: ChatHistory; policies: PolicyResult; user_id: string }
      >,
      res,
    ) => {
      const {
        body: { chat_history: chatHistory, policies, user_id: userId },
      } = req;
      try {
        if (!policies.createAllowed) {
          logger.error("Failed to create chat history: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to create chat history: Unauthorized!",
            }),
          );
          return;
        }
        await db.insertChatHistory(userId, chatHistory);
        logger.info(
          `Inserted new chat history: ${JSON.stringify(chatHistory)}`,
        );
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error("Failed to insert chat history:", error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.get("/", async (req, res) => {
    try {
      const {
        body: { user_id: userId, policies },
      } = req;
      if (!policies.readAllAllowed && !userId) {
        logger.error("Failed to fetch chat history: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to fetch chat history: Unauthorized!",
          }),
        );
        return;
      }
      const chatHistory = await db.getChatHistory(userId);
      logger.info(`Fetched all chat histories`);
      res.status(200).send({ chat_history: chatHistory });
      return;
    } catch (error) {
      logger.error("Failed to fetch all chat histories:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  return router;
}
