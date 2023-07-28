import { isNil, pick } from "lodash";
import { Email } from "../adapters/base";
import {
  AIMessage,
  Context,
  Database,
  HumanMessage,
  PotentialReplyEmail,
  RawChatHistory,
} from "./base";
import Knex, { Knex as KnexT } from "knex";

export class KnexDatabase extends Database {
  private db: KnexT;
  constructor(config: KnexT.Config) {
    super();
    this.db = Knex(config);
  }

  async connect(): Promise<void> {
    await this.db.raw("SELECT 1+1 AS result");
  }

  async disconnect(): Promise<void> {
    await this.db.destroy();
  }

  async insertEmail(email: Email): Promise<void> {
    if (isNil(email.date)) return;
    await this.db("emails")
      .insert(pick(email, this.emailKeys))
      .onConflict("hash")
      .ignore();
  }

  async insertEmails(emails: Email[]): Promise<void> {
    const procEmails = emails
      .filter((e) => !isNil(e.date))
      .map((email) => {
        return pick(email, this.emailKeys);
      });

    await this.db("emails").insert(procEmails).onConflict("hash").ignore();
  }

  async filterNotInDatabase(emails: Email[]) {
    const oldestEmailDate = emails
      .filter((e) => !isNil(e.date))
      .reduce((oldestDate, currentEmail) => {
        return currentEmail.date! < oldestDate!
          ? currentEmail.date
          : oldestDate;
      }, emails[0].date);

    const recentDbEmails = await this.db("emails")
      .where<string>("date", ">", oldestEmailDate!)
      .select();

    const newEmails = emails.filter(
      (serverEmail) =>
        !recentDbEmails.some((dbEmail) => dbEmail.hash === serverEmail.hash),
    );

    return newEmails;
  }

  async getEmails(): Promise<Email[] | null> {
    return this.db("emails")
      .select("*")
      .then((v) => (v.length > 0 ? v : null));
  }

  async getEmail(id: string): Promise<Email | null> {
    return this.db("emails")
      .where("id", id)
      .first()
      .then((v) => v || null);
  }

  async updateEmailProcessedData(
    id: string,
    status: string,
    summary?: string | undefined,
  ): Promise<void> {
    const updateData: Partial<Email> = { status };
    if (summary) updateData.summary = summary;
    await this.db("emails").where("id", id).update(updateData);
  }

  async insertContext(context: Context): Promise<void> {
    const entries = Object.entries(context).map(([key, value]) => ({
      key,
      value,
    }));
    await this.db("contexts").insert(entries);
  }

  async getContext(): Promise<Context | null> {
    return this.db("contexts")
      .select("*")
      .then((v) =>
        v.length > 0
          ? v.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
          : null,
      );
  }

  async getContextValue(key: string): Promise<string | null> {
    return this.db("contexts")
      .where("key", key)
      .first()
      .then((v) => v?.value || null);
  }

  async getAllowedHosts(): Promise<string[] | null> {
    return this.db("allowed_hosts")
      .select("*")
      .then((v) => (v.length > 0 ? v.map(({ host }) => host) : null));
  }

  async setAllowedHosts(hosts: string[]): Promise<void> {
    await this.db("allowed_hosts").insert(hosts.map((host) => ({ host })));
  }

  async deleteAllowedHosts(hosts: string[]): Promise<void> {
    await this.db("allowed_hosts").whereIn("host", hosts).delete();
  }

  async insertPotentialReply(data: PotentialReplyEmail): Promise<string> {
    const { intention, reply_text, email_id, summary } = data;
    return this.db("potential_replies")
      .insert({ intention, reply_text, email_id, summary })
      .returning("id")
      .then((ids) => ids[0]);
  }

  async getPotentialReply(id: string): Promise<PotentialReplyEmail> {
    return this.db("potential_replies")
      .where("id", id)
      .first()
      .then((v) => v || null);
  }

  async getPotentialReplies(
    emailId: string,
  ): Promise<PotentialReplyEmail[] | null> {
    return this.db("potential_replies")
      .where("email_id", emailId)
      .select("*")
      .then((v) => (v.length > 0 ? v : null));
  }

  async insertChatHistory(chatHistory: RawChatHistory): Promise<string> {
    return this.db("chat_history")
      .insert(chatHistory)
      .returning("id")
      .then((ids) => ids[0]);
  }

  async appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void> {
    await this.db.raw(
      `
      UPDATE chat_history
      SET chat_messages = (
        SELECT jsonb_agg(elems)
        FROM (
          SELECT elems
          from chat_history, jsonb_array_elements(chat_messages) WITH ORDINALITY arr(elems, order)
          WHERE id = :id
          UNION ALL
          SELECT jsonb_array_elements(:messageData::jsonb)
        ) sub
      )
      WHERE id = :id;
    `,
      { id, messageData: JSON.stringify(messages) },
    );
  }

  async getChatHistoryById(id: string): Promise<RawChatHistory> {
    return this.db("chat_history")
      .where("id", id)
      .first()
      .then((v) => v || null);
  }

  async getChatHistoryByReply(replyId: string): Promise<RawChatHistory> {
    return this.db("chat_history")
      .where("reply_id", replyId)
      .first()
      .then((v) => v || null);
  }
}
