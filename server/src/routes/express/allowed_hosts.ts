import express, { Request } from "express";
import { AllowedHost, Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";

export function buildAllowedHostsRoutes(db: Database) {
  const router = express.Router();
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.deleteAllowedHost(id);
      logger.info(`Deleted allowed hosts: ${id}`);
      res.status(200).send({ status: "ok" });
      return;
    } catch (error) {
      logger.error("Failed to delete allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  }); // delete allowed hosts

  router.get("/", async (_, res) => {
    try {
      const allowedHosts = await db.getAllowedHosts();
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
    async (req: Request<{}, {}, { hosts: AllowedHost[] }>, res) => {
      try {
        const { body } = req;
        await db.setAllowedHosts(body.hosts);
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
