import { simpleParser, ParsedMail } from "mailparser";

export type FetchOpts = {};

export interface EmailAddress {
  name: string;
  address: string;
}

export interface Email extends ParsedMail {
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

export interface SearchCriteria {
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
  abstract search(criteria: SearchCriteria): Promise<Email[]>; // where `SearchCriteria` is a class or interface you define
  abstract disconnect(): Promise<void>;

  static async parseEmail(rawEmail: string) {
    try {
      return simpleParser(rawEmail);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
