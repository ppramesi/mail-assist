import { Email } from "../adapters/base.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import _ from "lodash";

export type Context = Record<string, string>;

export type Message = {
  type: "ai" | "human";
  text: string;
};

export type AIMessage = Message & {
  type: "ai";
};

export type HumanMessage = Message & {
  type: "human";
};

export type ChatHistory = {
  id: string;
  email_id: string;
  reply_id: string;
  chat_messages: (AIMessage | HumanMessage)[];
};

export type AllowedHost = {
  id?: string;
  host: string;
  type: "string" | "regex";
};

export interface PotentialReplyEmail extends Email {
  process_status: "potential_reply";
  intention: string;
  reply_text: string;
  email_id: string;
  summary: string;
}

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
  abstract getEmails(): Promise<Email[] | null>;

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
  abstract insertContext(context: Context): Promise<string[] | null>;

  /**
   * Fetches all context from the database.
   */
  abstract getContext(): Promise<Context | null>;

  abstract deleteContext(id: string): Promise<void>;

  /**
   * Fetches a specific context from the database.
   * @param id The id of the context to fetch.
   */
  abstract getContextValue(key: string): Promise<string | null>;

  abstract setContextValue(
    id: string,
    key: string,
    value: string,
  ): Promise<void>;

  abstract getAllowedHosts(): Promise<AllowedHost[] | null>;

  abstract setAllowedHosts(hosts: AllowedHost[]): Promise<void>;

  abstract deleteAllowedHost(id: string): Promise<void>;

  abstract insertPotentialReply(data: PotentialReplyEmail): Promise<string>;

  abstract updatePotentialReply(id: string, text: string): Promise<void>;

  abstract getPotentialReply(id: string): Promise<PotentialReplyEmail | null>;

  abstract getPotentialRepliesByEmail(
    emailId: string,
  ): Promise<PotentialReplyEmail[] | null>;

  abstract insertChatHistory(chatHistory: ChatHistory): Promise<string>; // returns id

  abstract getChatHistory(): Promise<ChatHistory[] | null>;

  abstract appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void>;

  abstract getChatHistoryById(id: string): Promise<ChatHistory>;

  abstract getChatHistoryByEmail(emailId: string): Promise<ChatHistory>;

  abstract getChatHistoryByReply(replyId: string): Promise<ChatHistory>;

  abstract insertUser(email: string, password: string): Promise<void>;

  abstract getUserMetakey(email: string): Promise<string>;

  abstract getUserSessionKey(email: string): Promise<string>;

  abstract setUserSessionKey(email: string, sessionKey: string): Promise<void>;

  abstract getUserBySessionKey(
    sessionKey: string,
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

  static async hashPasswordAndGenerateStuff(password: string) {
    const salt = await bcrypt.genSalt(13);
    const hashedPassword = await bcrypt.hash(password, salt);
    const metakey = crypto.randomBytes(63).toString("base64");
    return { salt, metakey, password: hashedPassword };
  }
}
