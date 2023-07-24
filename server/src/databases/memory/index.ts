import { Email } from "../../adapters/base";
import {
  Database,
  Context,
  AIMessage,
  HumanMessage,
  RawChatHistory,
  DBPotentialReplyEmail,
} from "../base";

export class InMemoryDatabase extends Database {
  private emails: Email[];
  private context: Record<string, string>;
  private allowedHosts: string[];

  constructor() {
    super();
    this.emails = [];
    this.context = {};
    this.allowedHosts = [];
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

  async insertContext(context: Context): Promise<void> {
    // Push the new email onto the end of the array.
    this.context = {
      ...this.context,
      ...context,
    };
    return Promise.resolve();
  }

  async getContext(): Promise<Context | null> {
    // Return a copy of the array so that modifications do not affect the original data.
    return Promise.resolve({ ...this.context });
  }

  async getContextValue(key: string): Promise<string | null> {
    return Promise.resolve(this.context[key]);
  }

  async getAllowedHosts(): Promise<string[] | null> {
    return Promise.resolve([...this.allowedHosts]);
  }

  async setAllowedHosts(hosts: string[]): Promise<void> {
    this.allowedHosts = hosts;
    return Promise.resolve();
  }

  async updateEmailProcessedData(
    id: string,
    status: string,
    summary: string,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async insertPotentialReply(data: DBPotentialReplyEmail): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async getPotentialReply(id: string): Promise<RawChatHistory> {
    throw new Error("Method not implemented.");
  }

  async insertChatHistory(chatHistory: RawChatHistory): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getChatHistory(id: string): Promise<RawChatHistory> {
    throw new Error("Method not implemented.");
  }

  async getEmailChatHistory(emailId: string): Promise<RawChatHistory> {
    throw new Error("Method not implemented.");
  }
}
