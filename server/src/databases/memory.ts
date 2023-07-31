import { Email } from "../adapters/base";
import {
  Database,
  Context,
  AIMessage,
  HumanMessage,
  RawChatHistory,
  PotentialReplyEmail,
} from "./base";
import * as uuid from "uuid";

export class InMemoryDatabase extends Database {
  private emails: Email[];
  private context: Record<string, string>;
  private allowedHosts: string[];
  private potentialReply: PotentialReplyEmail[];
  private chatHistory: RawChatHistory[];

  constructor() {
    super();
    this.emails = [];
    this.context = {};
    this.allowedHosts = [];
    this.potentialReply = [];
    this.chatHistory = [];
  }

  async connect(): Promise<void> {
    // For an in-memory database, we don't need to do anything here.
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    // For an in-memory database, we don't need to do anything here.
    return Promise.resolve();
  }

  async insertEmail(email: Email): Promise<void> {
    // Push the new email onto the end of the array.
    this.emails.push(email);
    return Promise.resolve();
  }

  async insertEmails(emails: Email[]): Promise<void> {
    // Push the new email onto the end of the array.
    this.emails.push(...emails);
    return Promise.resolve();
  }

  async getEmails(): Promise<Email[] | null> {
    // Return a copy of the array so that modifications do not affect the original data.
    return Promise.resolve([...this.emails]);
  }

  async getEmail(id: string): Promise<Email | null> {
    // Find the email with the matching id.
    const email = this.emails.find((email) => email.id === id);
    return Promise.resolve(email || null);
  }

  async insertContext(context: Context): Promise<string[] | null> {
    // Push the new email onto the end of the array.
    this.context = {
      ...this.context,
      ...context,
    };
    return Promise.resolve([]);
  }

  async getContext(): Promise<Context | null> {
    // Return a copy of the array so that modifications do not affect the original data.
    return Promise.resolve({ ...this.context });
  }

  async getContextValue(key: string): Promise<string | null> {
    return Promise.resolve(this.context[key]);
  }

  async setContextValue(id: string, key: string, value: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getAllowedHosts(): Promise<string[] | null> {
    return Promise.resolve([...this.allowedHosts]);
  }

  async deleteAllowedHosts(hosts: string[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async setAllowedHosts(hosts: string[]): Promise<void> {
    this.allowedHosts = hosts;
    return Promise.resolve();
  }

  async updateEmailProcessedData(
    id: string,
    status: string,
    summary?: string,
  ): Promise<void> {
    const email = this.emails.find((email) => email.id === id)!;
    email.status = status;
    if (summary) {
      email.summary = summary;
    }
  }

  async insertPotentialReply(data: PotentialReplyEmail): Promise<string> {
    if (!data.id) {
      data.id = uuid.v4();
    }
    this.potentialReply.push(data);
    return Promise.resolve(data.id);
  }

  async updatePotentialReply(id: string, text: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getPotentialReply(id: string): Promise<PotentialReplyEmail> {
    return Promise.resolve(
      this.potentialReply.find((email) => email.id === id)!,
    );
  }

  async getPotentialRepliesByEmail(
    emailId: string,
  ): Promise<PotentialReplyEmail[] | null> {
    throw new Error("Method not implemented.");
  }

  async insertChatHistory(chatHistory: RawChatHistory): Promise<string> {
    if (!chatHistory.id) {
      chatHistory.id = uuid.v4();
    }
    this.chatHistory.push(chatHistory);
    return Promise.resolve(chatHistory.id);
  }

  async appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void> {
    const chatHistory = this.chatHistory.find(
      (chatHistory) => chatHistory.id === id,
    )!;
    messages.forEach((m) => chatHistory.chat_messages.push(m));
  }

  async getChatHistory(): Promise<RawChatHistory[] | null> {
    return Promise.resolve(this.chatHistory);
  }

  async getEmailChatHistory(potentialReplyId: string): Promise<RawChatHistory> {
    return Promise.resolve(
      this.chatHistory.find(
        (chatHistory) => chatHistory.reply_id === potentialReplyId,
      )!,
    );
  }

  async getChatHistoryById(id: string): Promise<RawChatHistory> {
    throw new Error("Method not implemented.");
  }

  async getChatHistoryByEmail(emailId: string): Promise<RawChatHistory> {
    throw new Error("Method not implemented.");
  }

  async getChatHistoryByReply(replyId: string): Promise<RawChatHistory> {
    throw new Error("Method not implemented.");
  }

  async getUserMetakey(email: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async getUserSessionKey(email: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async insertUser(email: string, password: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async setUserAuth(
    email: string,
    pass: string,
    hash: string,
    metakey: string,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async setUserSessionKey(email: string, sessionKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getUserBySessionKey(
    sessionKey: string,
  ): Promise<{ email: string; metakey: string } | null> {
    throw new Error("Method not implemented.");
  }

  async getUserAuth(
    email: string,
  ): Promise<{ password: string; salt: string }> {
    throw new Error("Method not implemented.");
  }

  filterNotInDatabase(emails: Email[]): Promise<Email[]> {
    throw new Error("Method not implemented.");
  }
}
