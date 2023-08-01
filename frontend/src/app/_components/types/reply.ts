import type { Email } from "./email"

export interface PotentialReplyEmail {
  intention: string;
  reply_text: string;
  email_id: string;
  summary: string;
}
