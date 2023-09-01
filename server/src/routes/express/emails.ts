import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import { Email, PolicyResult } from "../../schema/index.js";
import { Authorization } from "../../authorization/base.js";

export function buildEmailRoutes(db: Database, authorizer?: Authorization) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    const { body, params } = req;
    console.log({ body });
    const { user_id: userId } = body;
    if (authorizer) {
      if (userId) {
        const policies = await authorizer.getEmailPolicies(userId, {
          body,
          params,
          fromAccessToken: body.fromAccessToken,
        });
        body.policies = policies;
        next();
        return;
      } else {
        logger.error("Failed emails request: Unauthorized empty user");
        res
          .status(403)
          .send({ error: "Failed emails request: Unauthorized empty user" });
        return;
      }
    } else {
      body.policies = Authorization.buildDefaultAllowPolicy();
      next();
      return;
    }
  });

  router.post(
    "/bulk",
    async (
      req: Request<
        {},
        {},
        { emails: Email[]; policies: PolicyResult; user_id: string }
      >,
      res,
    ) => {
      const { body } = req;
      try {
        const { policies, user_id: userId } = body;
        if (!policies.updateAllAllowed) {
          logger.error("Failed to get emails: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to get chat history by emails: Unauthorized!",
            }),
          );
          return;
        }
        await db.doQuery((database) => database.insertEmails(body.emails), {
          jwt: { user_id: userId },
        });
        // await db.insertEmails(body.emails);
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
      req: Request<
        { id: string },
        {},
        {
          status: string;
          summary?: string;
          policies: PolicyResult;
          user_id: string;
        }
      >,
      res,
    ) => {
      const { id } = req.params;
      const { status, summary, policies, user_id: userId } = req.body;
      try {
        if (!policies.updateAllowed) {
          logger.error("Failed to update emails: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to update emails: Unauthorized!",
            }),
          );
          return;
        }
        await db.doQuery(
          (database) => database.updateEmailProcessedData(id, status, summary),
          { jwt: { user_id: userId } },
        );
        // await db.updateEmailProcessedData(id, status, summary);
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
      const {
        body: { policies, user_id: userId },
      } = req;
      if (!policies.readAllowed) {
        logger.error("Failed to fetch email: Unauthorized!");
        res
          .status(500)
          .send(
            JSON.stringify({ error: "Failed to fetch email: Unauthorized!" }),
          );
        return;
      }
      const email = await db.doQuery((database) => database.getEmail(id), {
        jwt: { user_id: userId },
      });
      // const email = await db.getEmail(id);
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
      const {
        body: { policies, user_id: userId },
      } = req;
      if (!policies.readAllAllowed && !userId) {
        logger.error("Failed to retch emails: Unauthorized!");
        res
          .status(500)
          .send(
            JSON.stringify({ error: "Failed to retch emails: Unauthorized!" }),
          );
        return;
      }
      const emails = await db.doQuery(
        (database) => database.getEmails(userId),
        { jwt: { user_id: userId } },
      );
      // const emails = await db.getEmails(userId);
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
    const {
      body: { email, user_id: userId, policies },
    } = req;
    try {
      if (!policies.createAllowed) {
        logger.error("Failed to retch emails: Unauthorized!");
        res
          .status(500)
          .send(
            JSON.stringify({ error: "Failed to retch emails: Unauthorized!" }),
          );
        return;
      }
      if (userId) {
        email.user_id = userId;
      }
      await db.doQuery((database) => database.insertEmail(email), {
        jwt: { user_id: userId },
      });
      // await db.insertEmail(email);
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
