import express, { Request } from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";

export function buildAllowedHostsRoutes(db: Database) {
  const router = express.Router();

  router.get("/", async (_, res) => {
    try {
      const allowedHosts = await db.getAllowedHosts();
      logger.info(`Fetched all allowed hosts: ${JSON.stringify(allowedHosts)}`);
      res.status(200).send({ allowed_hosts: allowedHosts });
    } catch (error) {
      logger.error("Failed to fetch allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
    }
  }); // get all allowed hosts

  router.post("/", async (req: Request<{}, {}, { hosts: string[] }>, res) => {
    try {
      const { body } = req;
      await db.setAllowedHosts(body.hosts);
      logger.info(`Set allowed hosts to: ${JSON.stringify(body.hosts)}`);
      res.status(200).send({ status: "ok" });
    } catch (error) {
      logger.error("Failed to set allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
    }
  }); // insert allowed hosts

  router.delete("/", async (req: Request<{}, {}, { hosts: string[] }>, res) => {
    try {
      const { body } = req;
      await db.deleteAllowedHosts(body.hosts);
      logger.info(`Deleted allowed hosts: ${JSON.stringify(body.hosts)}`);
      res.status(200).send({ status: "ok" });
    } catch (error) {
      logger.error("Failed to delete allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
    }
  }); // delete allowed hosts

  return router;
}
