import { BaseMailAdapter } from "../adapters/base";
import { Request, Response } from "express";
import { Database } from "../databases/base";

export function fetchMailService(
  mailAdapter: BaseMailAdapter,
  database: Database,
) {
  return async function (_req: Request, res: Response) {
    if (!mailAdapter.connected) {
      await mailAdapter.connect();
    }
    try {
      const emails = await mailAdapter.fetch();
      database.insertEmails(emails);
      res.send({ emails });
    } catch (error) {
      res.status(400).send({ error });
    }
  };
}
