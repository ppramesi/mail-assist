export interface Email{
  subject: string;
  text: string;
  date: Date;
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