import { Email } from "../adapters/base";

export type Context = Record<string, string>;

export type AIMessage = {
  type: "ai";
  text: string;
};

export type HumanMessage = {
  type: "human";
  text: string;
};

export type RawChatHistory = {
  id: string;
  potential_reply_id: string;
  chat_messages: (AIMessage | HumanMessage)[];
};

export interface DBSummarizedEmail extends Email {
  process_status: "summarized";
  summary: string;
}

export interface PotentialReplyEmail extends Email {
  process_status: "potential_reply";
  intention: string;
  reply_text: string;
  email_id: string;
}

export abstract class Database {
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

  /**
   * Inserts an email into the database.
   * @param email The email data to insert.
   */
  abstract insertEmails(emails: Email[]): Promise<void>;

  /**
   * Fetches all emails from the database.
   */
  abstract getEmails(): Promise<Email[] | null>;

  /**
   * Fetches a specific email from the database.
   * @param id The id of the email to fetch.
   */
  abstract getEmail(id: string): Promise<Email | null>;

  abstract updateEmailProcessedData(
    id: string,
    status: string,
    summary?: string,
  ): Promise<void>;

  /**
   * Inserts an context into the database.
   * @param context The context data to insert.
   */
  abstract insertContext(context: Context): Promise<void>;

  /**
   * Fetches all context from the database.
   */
  abstract getContext(): Promise<Context | null>;

  /**
   * Fetches a specific context from the database.
   * @param id The id of the context to fetch.
   */
  abstract getContextValue(key: string): Promise<string | null>;

  abstract getAllowedHosts(): Promise<string[] | null>;

  abstract setAllowedHosts(hosts: string[]): Promise<void>;

  abstract insertPotentialReply(data: PotentialReplyEmail): Promise<string>;

  abstract getPotentialReply(id: string): Promise<PotentialReplyEmail>;

  abstract insertChatHistory(chatHistory: RawChatHistory): Promise<string>; // returns id

  abstract appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void>;

  abstract getChatHistory(id: string): Promise<RawChatHistory>;

  abstract insertEmailChatHistory(chatHistory: RawChatHistory): Promise<string>; // returns id

  abstract getEmailChatHistory(replyId: string): Promise<RawChatHistory>;
}
