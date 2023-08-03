import _ from "lodash";
import { Email } from "../adapters/base.js";
import {
  AIMessage,
  AllowedHost,
  Context,
  Database,
  HumanMessage,
  PotentialReplyEmail,
  ChatHistory,
} from "./base.js";
import Knex, { Knex as KnexT } from "knex";

export class KnexDatabase extends Database {
  private db: KnexT;
  constructor(configOrInstance: KnexT.Config | KnexT) {
    super();
    if (!_.isFunction(configOrInstance) && _.isObject(configOrInstance)) {
      this.db = Knex.knex(configOrInstance);
    } else {
      this.db = configOrInstance;
    }
  }

  async connect(): Promise<void> {
    await this.db.raw("SELECT 1+1 AS result");
  }

  async disconnect(): Promise<void> {
    await this.db.destroy();
  }

  async insertEmail(email: Email): Promise<void> {
    if (_.isNil(email.date)) return;
    await this.db("emails")
      .insert(_.pick(email, this.emailKeys))
      .onConflict("hash")
      .ignore();
  }

  async insertEmails(emails: Email[]): Promise<void> {
    const emailsNotInDb = await this.filterNotInDatabase(emails);
    const procEmails = emailsNotInDb
      .filter((e) => !_.isNil(e.date))
      .map((email) => {
        return _.pick(email, this.emailKeys);
      });

    await this.db("emails").insert(procEmails).onConflict("hash").ignore();
  }

  async filterNotInDatabase(emails: Email[]) {
    const oldestEmailDate = emails
      .filter((e) => !_.isNil(e.date))
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

  async getLatestEmail(): Promise<Email | null> {
    return this.db("emails")
      .orderBy("date", "desc")
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

  async insertContext(context: Context): Promise<string[] | null> {
    const entries = Object.entries(context).map(([key, value]) => ({
      key,
      value,
    }));
    return this.db("contexts")
      .insert(entries)
      .returning("id")
      .then((v) => (v.length > 0 ? v : null));
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

  async deleteContext(id: string): Promise<void> {
    await this.db("contexts").where("id", id).delete();
  }

  async getContextValue(key: string): Promise<string | null> {
    return this.db("contexts")
      .where("key", key)
      .first()
      .then((v) => v?.value || null);
  }

  async setContextValue(id: string, key: string, value: string): Promise<void> {
    await this.db("context").where("id", id).update({
      key,
      value,
    });
  }

  async getAllowedHosts(): Promise<AllowedHost[] | null> {
    return this.db("allowed_hosts")
      .select("*")
      .then((v) =>
        v.length > 0
          ? v.map((host) => ({ host: host.host, type: host.type, id: host.id }))
          : null,
      );
  }

  async setAllowedHosts(hosts: AllowedHost[]): Promise<void> {
    await this.db("allowed_hosts").insert(
      hosts.map((host) => ({ host: host.host, type: host.type })),
    );
  }

  async deleteAllowedHost(id: string): Promise<void> {
    await this.db("allowed_hosts").where("id", id).delete();
  }

  async insertPotentialReply(data: PotentialReplyEmail): Promise<string> {
    const { intention, reply_text, email_id, summary } = data;
    return this.db("potential_replies")
      .insert({ intention, reply_text, email_id, summary })
      .returning("id")
      .then((ids) => ids[0]);
  }

  async updatePotentialReply(id: string, text: string): Promise<void> {
    await this.db("potential_replies").where("id", id).update({
      reply_text: text,
    });
  }

  async getPotentialReply(id: string): Promise<PotentialReplyEmail> {
    return this.db("potential_replies")
      .where("id", id)
      .first()
      .then((v) => v || null);
  }

  async getPotentialRepliesByEmail(
    emailId: string,
  ): Promise<PotentialReplyEmail[] | null> {
    return this.db("potential_replies")
      .where("email_id", emailId)
      .select("*")
      .then((v) => (v.length > 0 ? v : null));
  }

  getChatHistory(): Promise<ChatHistory[] | null> {
    return this.db("chat_history")
      .select("*")
      .then((v) => (v.length > 0 ? v : null));
  }

  async insertChatHistory(chatHistory: ChatHistory): Promise<string> {
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

  async getChatHistoryById(id: string): Promise<ChatHistory> {
    return this.db("chat_history")
      .where("id", id)
      .first()
      .then((v) => v || null);
  }

  async getChatHistoryByEmail(emailId: string): Promise<ChatHistory> {
    return this.db("chat_history")
      .where("email_id", emailId)
      .first()
      .then((v) => v || null);
  }

  async getChatHistoryByReply(replyId: string): Promise<ChatHistory> {
    return this.db("chat_history")
      .where("reply_id", replyId)
      .first()
      .then((v) => v || null);
  }

  async insertUser(email: string, rawPassword: string): Promise<void> {
    const { salt, metakey, password } =
      await Database.hashPasswordAndGenerateStuff(rawPassword);
    await this.db("users")
      .insert({
        email,
        password,
        salt,
        metakey,
      })
      .onConflict("email")
      .merge();
  }

  async getUserMetakey(email: string): Promise<string> {
    return this.db("users")
      .where("email", email)
      .returning("metakey")
      .first()
      .then((v) => v || null);
  }

  async getUserSessionKey(email: string): Promise<string> {
    return this.db("users")
      .where("email", email)
      .returning("session_key")
      .first()
      .then((v) => v || null);
  }

  async setUserSessionKey(email: string, sessionKey: string): Promise<void> {
    await this.db("users").where("email", email).update({
      session_key: sessionKey,
    });
  }

  async getUserBySessionKey(
    sessionKey: string,
  ): Promise<{ email: string; metakey: string } | null> {
    return this.db("users")
      .where("session_key", sessionKey)
      .returning(["email", "metakey"])
      .first()
      .then((v) => v || null);
  }

  async setUserAuth(
    email: string,
    password: string,
    salt: string,
    metakey: string,
  ): Promise<void> {
    await this.db("users")
      .insert({
        email,
        password,
        salt,
        metakey,
      })
      .onConflict("email")
      .merge();
  }

  async getUserAuth(
    email: string,
  ): Promise<{ password: string; salt: string } | null> {
    return this.db("users")
      .where("email", email)
      .first()
      .then((v) => (v ? { password: v.password, salt: v.salt } : null));
  }
}
