import express, { Request } from "express";
import { Database } from "../../databases/base";
import { Email } from "../../adapters/base";

export function buildEmailRoutes(db: Database) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const emails = await db.getEmails();
    res.status(200).send(emails);
  }); // get all emails

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const email = await db.getEmail(id);
    res.status(200).send(email);
  }); // get specific email by id

  router.post("/", async (req: Request<{}, {}, Email>, res) => {
    const { body: email } = req;
    await db.insertEmail(email);
    res.status(200).send({ status: "ok" });
  }); // insert a single email

  router.post("/bulk", async (req: Request<{}, {}, Email[]>, res) => {
    const { body: emails } = req;
    await db.insertEmails(emails);
    res.status(200).send({ status: "ok" });
  }); // insert multiple emails

  router.put(
    "/:id",
    async (
      req: Request<{ id: string }, {}, { status: string; summary?: string }>,
      res,
    ) => {
      const { id } = req.params;
      const { status, summary } = req.body;
      await db.updateEmailProcessedData(id, status, summary);
      res.status(200).send({ status: "ok" });
    },
  ); // update specific email's status and summary

  return router;
}
