import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import { AllowedHost, PolicyResult } from "../../schema/index.js";
import { Authorization } from "../../authorization/base.js";

export function buildAllowedHostsRoutes(
  db: Database,
  authorizer?: Authorization,
) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if (authorizer) {
      const { body, params } = req;
      const { user_id: userId } = body;
      if (userId) {
        const policies = await authorizer.getAllowedHostsPolicies(userId, {
          body,
          params,
          fromAccessToken: body.fromAccessToken,
        });
        body.policies = policies;
        next();
      } else {
        logger.error("Failed allowed hosts request: Unauthorized empty user");
        res.status(403).send({
          error: "Failed allowed hosts request: Unauthorized empty user",
        });
        return;
      }
    } else {
      next();
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.deleteAllowed) {
        logger.error("Failed to delete allowed hosts: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to delete allowed hosts: Unauthorized!",
          }),
        );
        return;
      }
      const { id } = req.params;
      await db.doQuery((database) => database.deleteAllowedHost(id));
      // await db.deleteAllowedHost(id);
      logger.info(`Deleted allowed hosts: ${id}`);
      res.status(200).send({ status: "ok" });
      return;
    } catch (error) {
      logger.error("Failed to delete allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  }); // delete allowed hosts

  router.post("/:id", async (req, res) => {
    try {
      const {
        body: { policies },
      } = req;
      if (!policies.updateAllowed) {
        logger.error("Failed to update allowed hosts: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to update allowed hosts: Unauthorized!",
          }),
        );
        return;
      }
      const { body, params } = req;
      await db.doQuery((database) =>
        database.updateAllowedHost(params.id, body.hosts),
      );
      // await db.updateAllowedHost(params.id, body.hosts);
      logger.info(`Set allowed hosts to: ${JSON.stringify(body.hosts)}`);
      res.status(200).send({ status: "ok" });
      return;
    } catch (error) {
      logger.error("Failed to update allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  router.get("/", async (req, res) => {
    try {
      const { body } = req;
      const { user_id: userId, policies } = body;
      if (!policies.readAllAllowed && !userId) {
        logger.error("Failed to fetch allowed hosts: Unauthorized!");
        res.status(500).send(
          JSON.stringify({
            error: "Failed to fetch allowed hosts: Unauthorized!",
          }),
        );
        return;
      }
      const allowedHosts = await db.doQuery((database) =>
        database.getAllowedHosts(userId),
      );
      // const allowedHosts = await db.getAllowedHosts(userId);
      logger.info(`Fetched all allowed hosts: ${JSON.stringify(allowedHosts)}`);
      res.status(200).send({ allowed_hosts: allowedHosts });
      return;
    } catch (error) {
      logger.error("Failed to fetch allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  }); // get all allowed hosts

  router.post(
    "/",
    async (
      req: Request<
        {},
        {},
        {
          hosts: Omit<AllowedHost, "id">[];
          policies: PolicyResult;
          user_id: string;
        }
      >,
      res,
    ) => {
      try {
        const {
          body: { policies },
        } = req;
        if (!policies.createAllowed) {
          logger.error("Failed to set allowed hosts: Unauthorized!");
          res.status(500).send(
            JSON.stringify({
              error: "Failed to set allowed hosts: Unauthorized!",
            }),
          );
          return;
        }
        const { body } = req;
        await db.doQuery((database) =>
          database.createAllowedHosts(body.user_id, body.hosts),
        );
        // await db.createAllowedHosts(body.user_id, body.hosts);
        logger.info(`Set allowed hosts to: ${JSON.stringify(body.hosts)}`);
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error("Failed to set allowed hosts:", error);
        res.status(500).send(JSON.stringify(error));
        return;
      }
    },
  ); // insert allowed hosts

  return router;
}
