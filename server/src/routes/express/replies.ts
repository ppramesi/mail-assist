import express, { Request } from "express";
import { Database, PotentialReplyEmail } from "../../databases/base";

export function buildReplyRoutes(db: Database) {
  const router = express.Router();

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const reply = await db.getPotentialReply(id);
    res.status(200).send(reply);
  }); // get specific reply by id

  router.get("/email/:emailId", async (req, res) => {
    const { emailId } = req.params;
    const replies = await db.getPotentialRepliesByEmail(emailId);
    res.status(200).send(replies);
  }); // get replies by email id

  router.post("/", async (req: Request<{}, {}, PotentialReplyEmail>, res) => {
    const { body } = req;
    const replyId = await db.insertPotentialReply(body);
    res.status(200).send({ status: "ok", replyId });
  }); // insert a potential reply

  return router;
}
