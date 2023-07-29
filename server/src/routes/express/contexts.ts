import express, { Request } from "express";
import { Database, Context } from "../../databases/base";

export function buildContextRoutes(db: Database) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const context = await db.getContext();
    res.status(200).send(context);
  }); // get the whole context

  router.get("/:key", async (req, res) => {
    const { key } = req.params;
    const value = await db.getContextValue(key);
    res.status(200).send({ [key]: value });
  }); // get specific context value by key

  router.post("/", async (req: Request<{}, {}, Context>, res) => {
    const { body } = req;
    await db.insertContext(body);
    res.status(200).send({ status: "ok" });
  }); // set multiple context key-value pairs

  router.post(
    "/:id",
    async (
      req: Request<{ id: string }, {}, { key: string; value: string }>,
      res,
    ) => {
      const { value, key } = req.body;
      const { id } = req.params;
      await db.setContextValue(id, key, value);
      res.status(200).send({ status: "ok" });
    },
  ); // set a single context key-value pair

  return router;
}
