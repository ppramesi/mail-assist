import { Email } from "../../adapters/base";
import {
  Database,
  Context,
  AIMessage,
  HumanMessage,
  RawChatHistory,
  PotentialReplyEmail,
} from "../base";
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
    const email = this.emails.find((email) => email.id === id)!
    email.status = status;
    email.summary = summary;
  }

  async insertPotentialReply(data: PotentialReplyEmail): Promise<string> {
    if(!data.id){
      data.id = uuid.v4();
    }
    this.potentialReply.push(data);
    return Promise.resolve(data.id);
  }

  async getPotentialReply(id: string): Promise<PotentialReplyEmail> {
    return Promise.resolve(this.potentialReply.find((email) => email.id === id)!);
  }

  async insertChatHistory(chatHistory: RawChatHistory): Promise<string> {
    if(!chatHistory.id){
      chatHistory.id = uuid.v4();
    }
    this.chatHistory.push(chatHistory);
    return Promise.resolve(chatHistory.id);
  }

  async appendChatHistory(
    id: string,
    messages: (AIMessage | HumanMessage)[],
  ): Promise<void> {
    const chatHistory = this.chatHistory.find((chatHistory) => chatHistory.id === id)!;
    messages.forEach(m => chatHistory.chat_messages.push(m))
  }

  async getChatHistory(id: string): Promise<RawChatHistory> {
    return Promise.resolve(this.chatHistory.find((chatHistory) => chatHistory.id === id)!);
  }

  async insertEmailChatHistory(chatHistory: RawChatHistory): Promise<string> {
    if(!chatHistory.id){
      chatHistory.id = uuid.v4();
    }
    this.chatHistory.push(chatHistory);
    return Promise.resolve(chatHistory.id);
  }

  async getEmailChatHistory(potentialReplyId: string): Promise<RawChatHistory> {
    return Promise.resolve(this.chatHistory.find((chatHistory) => chatHistory.potential_reply_id === potentialReplyId)!);
  }
}
