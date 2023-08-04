import { ParsedMail } from "mailparser";

export interface Email extends Pick<ParsedMail, "subject" | "text" | "date"> {
  id: string;
  read: boolean;
  hash: string;
  from: string[];
  to: string[];
  cc?: string[];
  bcc?: string[];
  status?: string;
  summary?: string;
}

export interface EmptyEmail extends Email {
  process_status: "empty";
}

export interface IrrelevantEmail extends Email {
  process_status: "irrelevant";
}

export interface SummarizedEmail extends Email {
  process_status: "summarized";
  summary: string;
}

export interface PotentialReplyEmail extends Email {
  process_status: "potential_reply";
  intention: string;
  reply_text: string;
  email_id: string;
  summary: string;
}

export type ProcessedEmail =
  | EmptyEmail
  | IrrelevantEmail
  | SummarizedEmail
  | PotentialReplyEmail;

export interface EmailAddress {
  name: string;
  address: string;
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

export type Context = Record<string, string>;

export type Message = {
  timestamp: number;
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
