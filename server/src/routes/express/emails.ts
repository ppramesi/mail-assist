import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import { Email, PolicyResult } from "../../schema/index.js";
import { Authorization } from "../../authorization/base.js";

export function buildEmailRoutes(db: Database, authorizer?: Authorization) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if(authorizer){
      const { body, params } = req
      const { user_id: userId } = body
      if(userId){
        const policies = await authorizer.getEmailPolicies(userId, { body, params })
        body.policies = policies;
        next()
      }else{
        logger.error("Failed emails request: Unauthorized empty user")
        res.status(403).send({ error: "Failed emails request: Unauthorized empty user" })
        return
      }
    }else{
      next()
    }
  })

  router.post(
    "/bulk",
    async (req: Request<{}, {}, { emails: Email[], policies: PolicyResult }>, res) => {
      const { body } = req;
      try {
        const { body: { policies } } = req
        if(!policies.updateAllAllowed){
          logger.error("Failed to get emails: Unauthorized!");
          res.status(500).send(JSON.stringify({ error: "Failed to get chat history by emails: Unauthorized!" }));
          return;
        }
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
      req: Request<{ id: string }, {}, { status: string; summary?: string, policies: PolicyResult }>,
      res,
    ) => {
      const { id } = req.params;
      const { status, summary } = req.body;
      try {
        const { body: { policies } } = req
        if(!policies.updateAllowed){
          logger.error("Failed to update emails: Unauthorized!");
          res.status(500).send(JSON.stringify({ error: "Failed to update emails: Unauthorized!" }));
          return;
        }
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
      const { body: { policies } } = req
      if(!policies.readAllowed){
        logger.error("Failed to fetch email: Unauthorized!");
        res.status(500).send(JSON.stringify({ error: "Failed to fetch email: Unauthorized!" }));
        return;
      }
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

  router.get("/", async (req, res) => {
    try {
      const { body: { policies, user_id: userId } } = req
      if(!policies.readAllAllowed && !userId){
        logger.error("Failed to retch emails: Unauthorized!");
        res.status(500).send(JSON.stringify({ error: "Failed to retch emails: Unauthorized!" }));
        return;
      }
      const emails = await db.getEmails(userId);
      logger.info("Fetched all emails");
      res.status(200).send({ emails });
      return;
    } catch (error) {
      logger.error("Failed to fetch all emails:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.post("/", async (req, res) => {
    const { body: { email, user_id: userId, policies }} = req;
    try {
      if(!policies.createAllowed){
        logger.error("Failed to retch emails: Unauthorized!");
        res.status(500).send(JSON.stringify({ error: "Failed to retch emails: Unauthorized!" }));
        return;
      }
      if(userId){
        email.user_id = userId
      }
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
