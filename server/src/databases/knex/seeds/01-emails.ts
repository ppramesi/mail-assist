import { Knex } from "knex";
import { FakeMailAdapter } from "../../../adapters/fake/index"
import { pick } from "lodash";

export async function seed(knex: Knex): Promise<void> {
  const mailAdapter = new FakeMailAdapter()
  const emails = await mailAdapter.fetch()
  const keys = [
    "id",
    "hash",
    "from",
    "to",
    "cc",
    "bcc",
    "subject",
    "text",
    "date",
    "read",
    "summary",
    "status",
  ];
  const formattedEmails = emails.map(v => pick(v, keys))
  // Deletes ALL existing entries
  await knex("emails").del();

  // Inserts seed entries
  await knex("emails").insert(formattedEmails);
};
