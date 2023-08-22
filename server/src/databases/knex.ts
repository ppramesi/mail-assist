import _ from "lodash";
import Knex, { Knex as KnexT } from "knex";
import { encrypt, decrypt } from "../utils/crypto.js";
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
  protected db: KnexT;
  constructor(configOrInstance: KnexT.Config | KnexT.Transaction | KnexT) {
    super();
    if (
      !_.isFunction(configOrInstance) &&
      _.isObject(configOrInstance) &&
      configOrInstance.constructor.name === "Object"
    ) {
      this.db = Knex.knex(configOrInstance);
    } else {
      this.db = configOrInstance as KnexT;
    }
  }

  async connect(): Promise<void> {
    await this.db.raw("SELECT 1+1 AS result");
  }

  async disconnect(): Promise<void> {
    await this.db.destroy();
  }

  doQuery<T>(query: (db: KnexDatabase) => Promise<T>): Promise<T> {
    return query(this);
  }

  async insertTempKeys(
    id: string,
    keys: { publicKey: string; privateKey: string },
  ): Promise<void> {
    await this.db("temp_keys")
      .insert({ id, public_key: keys.publicKey, private_key: keys.privateKey })
      .onConflict("id")
      .merge();
  }

  async getTempKeys(
    id: string,
  ): Promise<{ public_key: string; private_key: string }> {
    const keys = await this.db("temp_keys").where("id", id).select();
    if (keys.length === 0) return { public_key: "", private_key: "" };
    return keys[0];
  }

  async deleteTempKey(id: string): Promise<void> {
    await this.db("temp_keys").where("id", id).delete();
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

  async insertContext(
    userId: string,
    context: Context,
  ): Promise<string[] | null> {
    const entries = Object.entries(context).map(([key, value]) => ({
      key,
      value,
      user_id: userId,
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

  async createAllowedHosts(
    userId: string,
    hosts: AllowedHost[],
  ): Promise<void> {
    await this.db("allowed_hosts").insert(
      hosts.map((host) => ({
        host: host.host,
        type: host.type,
        user_id: userId,
      })),
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

  async insertReplyEmail(userId: string, data: ReplyEmail): Promise<string> {
    const { intention, reply_text, email_id, summary } = data;
    return this.db("reply_emails")
      .insert({ intention, reply_text, email_id, summary, user_id: userId })
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

  async getChatHistory(userId?: string): Promise<ChatHistory[] | null> {
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

  async insertChatHistory(
    userId: string,
    chatHistory: ChatHistory,
  ): Promise<string> {
    return this.db("chat_history")
      .insert({
        ...chatHistory,
        user_id: userId,
      })
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

  async upsertUser(
    id: string,
    email: string,
    password: string,
    salt: string,
    metakey: string,
  ): Promise<string> {
    const constructedId = await this.db("users")
      .insert({
        id,
        email,
        password,
        salt,
        metakey,
      })
      .onConflict("email")
      .ignore()
      .returning("id")
      .then((v) => v[0]);

    if (constructedId) {
      await this.db("user_roles")
        .insert({
          user_id: id,
          role: "user",
        })
        .onConflict(["user_id", "role"])
        .merge();
    }

    return constructedId;
  }

  async createNewUser(
    email: string,
    password: string,
    salt: string,
    metakey: string,
  ): Promise<string> {
    const id = await this.db("users")
      .insert({
        email,
        password,
        salt,
        metakey,
      })
      .onConflict("email")
      .ignore()
      .returning("id")
      .then((v) => v[0]);

    if (id) {
      await this.db("user_roles")
        .insert({
          user_id: id,
          role: "user",
        })
        .onConflict(["user_id", "role"])
        .merge();
    }

    return id;
  }

  async setUserImapSettings(
    userId: string,
    imapSettings: {
      imap_password?: string;
      imap_host?: string;
      imap_port?: string;
      imap_settings?: Record<string, any>;
    },
  ): Promise<void> {
    const user = await this.db("users")
      .where({
        id: userId,
      })
      .returning(["email", "metakey", "salt"])
      .first()
      .then((v) =>
        v
          ? {
              metakey: v.metakey,
              email: v.email,
              salt: v.salt,
            }
          : null,
      );

    if (!user) {
      throw new Error("User not found");
    }
    const { metakey, salt } = user;
    const { imap_password: emailPassword, ...settings } = imapSettings;
    const settingsDupe = { ...settings } as {
      imap_password?: string;
      imap_host?: string;
      imap_port?: string;
      imap_settings?: Record<string, any>;
    };
    if (emailPassword) {
      settingsDupe.imap_password = encrypt(emailPassword, metakey, salt);
    }

    await this.db("users")
      .where({
        id: userId,
      })
      .update({
        ...settingsDupe,
      });
  }

  async getUserImapSettings(userId: string): Promise<{
    user: string;
    password: string;
    host: string;
    port: string;
    imap_settings?: Record<string, any>;
  } | null> {
    const settings = await this.db("users")
      .where({ id: userId })
      .returning("*")
      .first()
      .then((v) =>
        v
          ? {
              metakey: v.metakey,
              user: v.email,
              password: v.imap_password,
              host: v.imap_host,
              port: v.imap_port,
              imap_settings: v.imap_settings,
              salt: v.salt,
            }
          : null,
      );

    if (!settings || !settings.password || !settings.host || !settings.port) {
      return null;
    }

    const { metakey, salt, ...rest } = settings;
    settings.password = decrypt(rest.password, metakey, salt);

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
      .returning("refresh_token")
      .first()
      .then((v) => v || null);
  }

  async setUserSessionKey(email: string, sessionToken: string): Promise<void> {
    await this.db("users").where("email", email).update({
      refresh_token: sessionToken,
    });
  }

  async getUserBySessionKey(
    sessionToken: string,
  ): Promise<{ email: string; metakey: string } | null> {
    return this.db("users")
      .where("refresh_token", sessionToken)
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
