import express, { Request } from "express";
import { Database } from "../../databases/base";
import logger from "../../logger/bunyan";

export function buildAllowedHostsRoutes(db: Database) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const allowedHosts = await db.getAllowedHosts();
      logger.info(`Fetched all allowed hosts: ${JSON.stringify(allowedHosts)}`);
      res.status(200).send(allowedHosts);
    } catch (error) {
      logger.error("Failed to fetch allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
    }
  }); // get all allowed hosts

  router.post("/", async (req: Request<{}, {}, string[]>, res) => {
    try {
      const { body } = req;
      await db.setAllowedHosts(body);
      logger.info(`Set allowed hosts to: ${JSON.stringify(body)}`);
      res.status(200).send({ status: "ok" });
    } catch (error) {
      logger.error("Failed to set allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
    }
  }); // insert allowed hosts

  router.delete("/", async (req: Request<{}, {}, string[]>, res) => {
    try {
      const { body } = req;
      await db.deleteAllowedHosts(body);
      logger.info(`Deleted allowed hosts: ${JSON.stringify(body)}`);
      res.status(200).send({ status: "ok" });
    } catch (error) {
      logger.error("Failed to delete allowed hosts:", error);
      res.status(500).send(JSON.stringify(error));
    }
  }); // delete allowed hosts

  return router;
}
