import type { ParsedMail } from "mailparser"

export interface Email
  extends Pick<ParsedMail, "subject" | "text" | "date"> {
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