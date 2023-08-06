import _ from "lodash";
import Knex, { Knex as KnexT } from "knex";
import crypto from "crypto";
import { Database } from "./base.js";
import {
  AIMessage,
  AllowedHost,
  ChatHistory,
  Context,
  Email,
  HumanMessage,
  ReplyEmail,
} from "../schema/index.js";

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
    const procEmails = emails
      .filter((e) => !_.isNil(e.date))
      .map((email) => {
        return _.pick(email, this.emailKeys);
      });

    await this.db("emails").insert(procEmails).onConflict("hash").ignore();
  }

  async insertUnseenEmails(emails: Email[]): Promise<Email[]> {
    if (emails.length === 0) return [];
    const emailsNotInDb = await this.filterNotInDatabase(emails);
    const procEmails = emailsNotInDb
      .filter((e) => !_.isNil(e.date))
      .map((email) => {
        return _.pick(email, this.emailKeys);
      });

    await this.db("emails").insert(procEmails).onConflict("hash").ignore();
    return emailsNotInDb;
  }

  async getEmailsAfterDate(date: Date): Promise<Email[]> {
    return this.db("emails")
      .where<string>("date", ">", date)
      .select()
      .then((v) => v || []);
  }

  async getEmails(userId?: string): Promise<Email[] | null> {
    if (userId) {
      return this.db("emails")
        .where({ user_id: userId })
        .select("*")
        .then((v) => (v.length > 0 ? v : null));
    } else {
      return this.db("emails")
        .select("*")
        .then((v) => (v.length > 0 ? v : null));
    }
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

  async getContext(userId?: string): Promise<Context | null> {
    if (userId) {
      return this.db("contexts")
        .where({ user_id: userId })
        .select("*")
        .then((v) =>
          v.length > 0
            ? v.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
            : null,
        );
    } else {
      return this.db("contexts")
        .select("*")
        .then((v) =>
          v.length > 0
            ? v.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
            : null,
        );
    }
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

  async getContextById(id: string): Promise<Context | null> {
    return this.db("contexts")
      .where("id", id)
      .first()
      .then((v) => v ?? null);
  }

  async getContextsByUser(email: string): Promise<Context | null> {
    return this.db("contexts")
      .join("users", "contexts.user_id", "users.id")
      .where("users.email", email)
      .select("contexts.*")
      .then((contexts) =>
        contexts.length > 0
          ? contexts.reduce(
              (acc, { key, value }) => ({ ...acc, [key]: value }),
              {},
            )
          : null,
      );
  }

  async setContextValue(id: string, key: string, value: string): Promise<void> {
    await this.db("context").where("id", id).update({
      key,
      value,
    });
  }

  async getAllowedHosts(userId?: string): Promise<AllowedHost[] | null> {
    if (userId) {
      return this.db("allowed_hosts")
        .where({ user_id: userId })
        .select("*")
        .then((v) =>
          v.length > 0
            ? v.map((host) => ({
                host: host.host,
                type: host.type,
                id: host.id,
              }))
            : null,
        );
    } else {
      return this.db("allowed_hosts")
        .select("*")
        .then((v) =>
          v.length > 0
            ? v.map((host) => ({
                host: host.host,
                type: host.type,
                id: host.id,
              }))
            : null,
        );
    }
  }

  async createAllowedHosts(hosts: AllowedHost[]): Promise<void> {
    await this.db("allowed_hosts").insert(
      hosts.map((host) => ({ host: host.host, type: host.type })),
    );
  }

  async updateAllowedHost(
    hostId: string,
    host: Omit<AllowedHost, "id">,
  ): Promise<void> {
    await this.db("allowed_hosts").where({ id: hostId }).update(host);
  }

  async deleteAllowedHost(id: string): Promise<void> {
    await this.db("allowed_hosts").where("id", id).delete();
  }

  async insertReplyEmail(data: ReplyEmail): Promise<string> {
    const { intention, reply_text, email_id, summary } = data;
    return this.db("reply_emails")
      .insert({ intention, reply_text, email_id, summary })
      .returning("id")
      .then((ids) => ids[0]);
  }

  async updateReplyEmail(id: string, text: string): Promise<void> {
    await this.db("reply_emails").where("id", id).update({
      reply_text: text,
    });
  }

  async getReplyEmail(id: string): Promise<ReplyEmail> {
    return this.db("reply_emails")
      .where("id", id)
      .first()
      .then((v) => v || null);
  }

  async getReplyEmailsByEmail(emailId: string): Promise<ReplyEmail[] | null> {
    return this.db("reply_emails")
      .where("email_id", emailId)
      .select("*")
      .then((v) => (v.length > 0 ? v : null));
  }

  getChatHistory(userId?: string): Promise<ChatHistory[] | null> {
    if (userId) {
      return this.db("chat_history")
        .where({ user_id: userId })
        .select("*")
        .then((v) => (v.length > 0 ? v : null));
    } else {
      return this.db("chat_history")
        .select("*")
        .then((v) => (v.length > 0 ? v : null));
    }
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

  async getUsers(): Promise<{ id: string; email: string }[]> {
    return this.db("users")
      .select("email")
      .select("id")
      .then((v) => {
        return v;
      });
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

  async setUserImapSettings(
    userId: string,
    imapSettings: {
      email_password: string;
      email_host: string;
      email_port: string;
      imap_settings?: string;
    },
  ): Promise<void> {
    const user = await this.db("users")
      .where({
        id: userId,
      })
      .returning(["email", "metakey"])
      .first()
      .then((v) =>
        v
          ? {
              metakey: v.metakey,
              email: v.email,
            }
          : null,
      );

    if (!user) {
      throw new Error("User not found");
    }
    const { metakey } = user;
    const { email_password: emailPassword, ...settings } = imapSettings;
    const textEncoder = new TextEncoder();
    const key = textEncoder.encode(process.env.TOKEN_KEY);
    const initVector = textEncoder.encode(metakey);
    const algo = "aes-256-cbc";
    const cipher = crypto.createCipheriv(algo, key, initVector);
    let encrypted = cipher.update(emailPassword, "utf-8", "base64");
    encrypted += cipher.final("base64");

    await this.db("users")
      .where({
        us: userId,
      })
      .update({
        ...settings,
        email_password: encrypted,
      });
  }

  async getUserImapSettings(userId: string): Promise<{
    email: string;
    email_password: string;
    email_host: string;
    email_port: string;
    imap_settings?: Record<string, any>;
  } | null> {
    const settings = await this.db("users")
      .where({ id: userId })
      .returning("email")
      .first()
      .then((v) =>
        v
          ? {
              metakey: v.metakey,
              email: v.email,
              email_password: v.email_password,
              email_host: v.email_host,
              email_port: v.email_port,
              imap_settings: v.imap_settings,
            }
          : null,
      );

    if (!settings) {
      return null;
    }

    const { metakey, ...rest } = settings;
    const textEncoder = new TextEncoder();
    const key = textEncoder.encode(process.env.TOKEN_KEY);
    const initVector = textEncoder.encode(metakey);
    const algo = "aes-256-cbc";
    const cipher = crypto.createDecipheriv(algo, key, initVector);

    let decrypted = cipher.update(rest.email_password, "base64", "utf-8");
    decrypted += cipher.final("utf-8");

    settings.email_password = decrypted;

    return settings;
  }

  async getUserByEmail(
    email: string,
  ): Promise<{ email: string; id: string; metakey: string } | null> {
    return this.db("users")
      .where("email", email)
      .returning(["email", "id", "metakey"])
      .first()
      .then((v) =>
        v
          ? {
              email: v.email,
              id: v.id,
              metakey: v.metakey,
            }
          : null,
      );
  }

  async getUserMetakey(email: string): Promise<string> {
    return this.db("users")
      .where("email", email)
      .returning("metakey")
      .first()
      .then((v) => v.metakey || null);
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
