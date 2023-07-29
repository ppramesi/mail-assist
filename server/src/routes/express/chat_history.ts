import express, { Request } from "express";
import { Database, RawChatHistory, Message } from "../../databases/base";
export function buildChatHistoryRoutes(db: Database) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const chatHistory = await db.getChatHistory();
    res.status(200).send(chatHistory);
  }); // get all chat history

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const chatHistory = await db.getChatHistoryById(id);
    res.status(200).send(chatHistory);
  }); // get specific chat history by id

  router.get("/email/:emailId", async (req, res) => {
    const { emailId } = req.params;
    const chatHistory = await db.getChatHistoryByEmail(emailId);
    res.status(200).send(chatHistory);
  });

  router.get("/reply/:replyId", async (req, res) => {
    const { replyId } = req.params;
    const chatHistory = await db.getChatHistoryByReply(replyId);
    res.status(200).send(chatHistory);
  }); // get chat history by reply id

  router.post("/", async (req: Request<{}, {}, RawChatHistory>, res) => {
    const { body } = req;
    await db.insertChatHistory(body);
    res.status(200).send({ status: "ok" });
  }); // insert a chat history

  router.put(
    "/:id",
    async (req: Request<{ id: string }, {}, Message[]>, res) => {
      const { body } = req;
      const { id } = req.params;
      await db.appendChatHistory(id, body);
      res.status(200).send({ status: "ok" });
    },
  ); // append to a chat history

  return router;
}
