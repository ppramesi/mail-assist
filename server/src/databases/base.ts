import bcrypt from "bcrypt";
import crypto from "crypto";
import _ from "lodash";
import {
  AIMessage,
  AllowedHost,
  ChatHistory,
  Context,
  Email,
  HumanMessage,
  ReplyEmail,
} from "../schema/index.js";

export abstract class Database {
  protected emailKeys = [
    "hash",
    "id",
    "from",
    "to",
    "subject",
    "text",
    "date",
    "read",
    "summary",
    "status",
  ];
  /**
   * Establishes a connection to the database.
   */
  abstract connect(): Promise<void>;

  /**
   * Closes the connection to the database.
   */
  abstract disconnect(): Promise<void>;

  abstract insertTempKeys(
    id: string,
    keys: { publicKey: string; privateKey: string },
  ): Promise<void>;

  abstract getTempKeys(
    id: string,
  ): Promise<{ public_key: string; private_key: string }>;

  abstract deleteTempKey(id: string): Promise<void>;

  /**
   * Inserts an email into the database.
   * @param email The email data to insert.
   */
  abstract insertEmail(email: Email): Promise<void>;

  abstract insertEmails(emails: Email[]): Promise<void>;

  /**
   * Inserts an email into the database.
   * Returns emails that were not in the database
   * @param email The email data to insert.
   */
  abstract insertUnseenEmails(emails: Email[]): Promise<Email[]>;

  abstract getEmailsAfterDate(date: Date): Promise<Email[]>;

  async filterNotInDatabase(emails: Email[]) {
    const oldestEmailDate = emails
      .filter((e) => !_.isNil(e.date))
      .reduce((oldestDate, currentEmail) => {
        return currentEmail.date! < oldestDate!
          ? currentEmail.date
          : oldestDate;
      }, emails[0].date);

    const recentDbEmails = await this.getEmailsAfterDate(oldestEmailDate!);

    const newEmails = emails.filter(
      (serverEmail) =>
        !recentDbEmails.some((dbEmail) => dbEmail.hash === serverEmail.hash),
    );

    return newEmails;
  }

  /**
   * Fetches all emails from the database.
   */
  abstract getEmails(userId?: string): Promise<Email[] | null>;

  /**
   * Fetches a specific email from the database.
   * @param id The id of the email to fetch.
   */
  abstract getEmail(id: string): Promise<Email | null>;

  abstract getLatestEmail(): Promise<Email | null>;

  /**
   * updates an email's status and summary (if exists)
   * @param id
   * @param status
   * @param summary
   */
  abstract updateEmailProcessedData(
    id: string,
    status: string,
    summary?: string,
  ): Promise<void>;

  /**
   * Inserts an context into the database.
   * @param context The context data to insert.
   */
  abstract insertContext(
    userId: string,
    context: Context,
  ): Promise<string[] | null>;

  /**
   * Fetches all context from the database.
   */
  abstract getContext(userId?: string): Promise<Context | null>;

  abstract deleteContext(id: string): Promise<void>;

  /**
   * Fetches a specific context from the database.
   * @param id The id of the context to fetch.
   */
  abstract getContextValue(key: string): Promise<string | null>;

  abstract getContextById(id: string): Promise<Context | null>;

  abstract getContextsByUser(email: string): Promise<Context | null>;

  abstract setContextValue(
    id: string,
    key: string,
    value: string,
  ): Promise<void>;

  abstract getAllowedHosts(userId?: string): Promise<AllowedHost[] | null>;

  abstract createAllowedHosts(
    userId: string,
    hosts: AllowedHost[],
  ): Promise<void>;

  abstract updateAllowedHost(
    hostId: string,
    host: Omit<AllowedHost, "id">,
  ): Promise<void>;

  abstract deleteAllowedHost(id: string): Promise<void>;

  abstract insertReplyEmail(userId: string, data: ReplyEmail): Promise<string>;

  abstract updateReplyEmail(id: string, text: string): Promise<void>;

  abstract getReplyEmail(id: string): Promise<ReplyEmail | null>;

  abstract getReplyEmailsByEmail(emailId: string): Promise<ReplyEmail[] | null>;

  abstract insertChatHistory(
    userId: string,
    chatHistory: Omit<ChatHistory, "id">,
  ): Promise<string>; // returns id

  abstract getChatHistory(userId?: string): Promise<ChatHistory[] | null>;

  abstract appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void>;

  abstract getChatHistoryById(id: string): Promise<ChatHistory | null>;

  abstract getChatHistoryByEmail(emailId: string): Promise<ChatHistory | null>;

  abstract getChatHistoryByReply(replyId: string): Promise<ChatHistory | null>;

  abstract upsertUser(
    id: string,
    email: string,
    password: string,
    salt: string,
    metakey: string,
  ): Promise<string>;

  abstract createNewUser(
    email: string,
    password: string,
    salt: string,
    metakey: string,
  ): Promise<string>;

  abstract getUsers(): Promise<{ id: string; email: string }[]>;

  abstract setUserImapSettings(
    userId: string,
    imapSettings: {
      imap_password?: string;
      imap_host?: string;
      imap_port?: string;
      imap_settings?: Record<string, any>;
    },
  ): Promise<void>;

  abstract getUserImapSettings(userId: string): Promise<{
    user: string;
    password: string;
    host: string;
    port: string;
    imap_settings?: Record<string, any>;
  } | null>;

  abstract getUserByEmail(
    email: string,
  ): Promise<{ email: string; id: string; metakey: string } | null>;

  abstract getUserMetakey(email: string): Promise<string>;

  abstract getUserSessionKey(email: string): Promise<string>;

  abstract setUserSessionKey(
    email: string,
    sessionToken: string,
  ): Promise<void>;

  abstract getUserBySessionKey(
    sessionToken: string,
  ): Promise<{ email: string; metakey: string } | null>;

  abstract setUserAuth(
    email: string,
    pass: string,
    salt: string,
    metakey: string,
  ): Promise<void>;

  abstract getUserAuth(
    email: string,
  ): Promise<{ password: string; salt: string } | null>;

  abstract doQuery<T>(
    query: (db: Database) => Promise<T>,
    options?: Record<string, any>,
  ): Promise<T>;

  static async hashPasswordAndGenerateStuff(password: string) {
    const salt = await bcrypt.genSalt(13);
    const hashedPassword = await bcrypt.hash(password, salt);
    const metakey = crypto.randomBytes(63).toString("base64");
    return { salt, metakey, password: hashedPassword };
  }
}
