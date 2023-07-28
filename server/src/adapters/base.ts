import { simpleParser, ParsedMail } from "mailparser";
import crypto from "crypto";

export type FetchOpts = {};

export interface EmailAddress {
  name: string;
  address: string;
}

export interface Email
  extends Pick<ParsedMail, "from" | "to" | "subject" | "text" | "date"> {
  hash: string;
  id: string;
  read: boolean;
  status?: string;
  summary?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  data: Buffer; // or other type suitable for storing binary data
}

export interface SearchContext {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  dateRange?: DateRange;
  hasAttachments?: boolean;
  read?: boolean;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export abstract class MailAdapter {
  abstract connected: boolean;
  constructor(public opts: FetchOpts) {}
  abstract connect(): Promise<void>;
  abstract fetch(): Promise<Email[]>; // where `Email` is a class or interface you define
  abstract send(email: Email): Promise<void>;
  abstract delete(emailId: string): Promise<void>;
  abstract markAsRead(emailId: string): Promise<void>;
  abstract search(context: SearchContext): Promise<Email[]>; // where `SearchContext` is a class or interface you define
  abstract disconnect(): Promise<void>;

  static hashText(text: string) {
    return crypto
      .createHash("SHA-256")
      .update(new TextEncoder().encode(text))
      .digest("base64");
  }

  static async parseEmail(rawEmail: string) {
    try {
      return simpleParser(rawEmail);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
