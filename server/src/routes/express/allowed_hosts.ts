import express, { Request } from "express";
import { Database } from "../../databases/base";

export function buildAllowedHostsRoutes(db: Database) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const allowedHosts = await db.getAllowedHosts();
    res.status(200).send(allowedHosts);
  }); // get all allowed hosts

  router.post("/", async (req: Request<{}, {}, string[]>, res) => {
    const { body } = req;
    await db.setAllowedHosts(body);
    res.status(200).send({ status: "ok" });
  }); // insert allowed hosts

  router.delete("/", async (req: Request<{}, {}, string[]>, res) => {
    const { body } = req;
    await db.deleteAllowedHosts(body);
    res.status(200).send({ status: "ok" });
  }); // delete allowed hosts

  return router;
}
