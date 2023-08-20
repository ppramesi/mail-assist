import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import { PolicyResult, ReplyEmail } from "../../schema/index.js";
import { Authorization } from "../../authorization/base.js";

export function buildReplyRoutes(db: Database, authorizer?: Authorization) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if (authorizer) {
      const { body, params } = req;
      const { user_id: userId } = body;
      if (userId) {
        const policies = await authorizer.getReplyEmailPolicies(userId, {
          body,
          params,
          fromAccessToken: body.fromAccessToken,
        });
        body.policies = policies;
        next();
      } else {
        logger.error("Failed emails request: Unauthorized empty user");
        res
          .status(403)
          .send({ error: "Failed emails request: Unauthorized empty user" });
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
        logger.error("Failed to get replies: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to get chat history by replies: Unauthorized!",
          }),
        );
        return;
      }
      const replies = await db.doQuery((database) =>
        database.getReplyEmailsByEmail(emailId),
      );
      // const replies = await db.getReplyEmailsByEmail(emailId);
      logger.info(`Fetched reply emails by email id: ${emailId}`);
      res.status(200).send({ replies });
      return;
    } catch (error) {
      logger.error(
        `Failed to fetch reply emails by email id: ${emailId}`,
        error,
      );
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.readAllowed) {
        logger.error("Failed to get replies: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to get chat history by replies: Unauthorized!",
          }),
        );
        return;
      }
      const reply = await db.doQuery((database) => database.getReplyEmail(id));
      // const reply = await db.getReplyEmail(id);
      logger.info(`Fetched reply email by id: ${id}`);
      res.status(200).send({ reply });
      return;
    } catch (error) {
      logger.error(`Failed to fetch reply email by id: ${id}`, error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.post(
    "/:id",
    async (
      req: Request<
        { id: string },
        {},
        { text: string; policies: PolicyResult }
      >,
      res,
    ) => {
      const {
        body,
        params: { id },
      } = req;
      try {
        const {
          body: { policies },
        } = req;
        if (!policies.updateAllowed) {
          logger.error("Failed to update replies: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to update by replies: Unauthorized!",
            }),
          );
          return;
        }
        const replyId = await db.doQuery((database) =>
          database.updateReplyEmail(id, body.text),
        );
        // const replyId = await db.updateReplyEmail(id, body.text);
        logger.info(
          `Updated reply email: ${JSON.stringify(body)}, reply id: ${replyId}`,
        );
        res.status(200).send({ status: "ok", replyId });
        return;
      } catch (error) {
        logger.error("Failed to update reply email:", error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  router.post(
    "/",
    async (
      req: Request<
        {},
        {},
        { replies: ReplyEmail; policies: PolicyResult; user_id: string }
      >,
      res,
    ) => {
      const { body } = req;
      const { user_id: userId } = body;
      try {
        const {
          body: { policies, replies },
        } = req;
        if (!policies.createAllAllowed) {
          logger.error("Failed to get replies: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to get chat history by replies: Unauthorized!",
            }),
          );
          return;
        }
        const replyId = await db.doQuery((database) =>
          database.insertReplyEmail(userId, replies),
        );
        // const replyId = await db.insertReplyEmail(userId, replies);
        logger.info(
          `Inserted reply email: ${JSON.stringify(body)}, reply id: ${replyId}`,
        );
        res.status(200).send({ status: "ok", replyId });
        return;
      } catch (error) {
        logger.error("Failed to insert reply email:", error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  );

  return router;
}
