import { Email, MailAdapter, SearchContext } from "../base";
import * as uuid from "uuid";
import {
  TEST_EMAILS_1,
  TEST_EMAILS_2,
  TEST_EMAILS_3,
  TEST_EMAILS_4,
} from "./emails/fake_emails";

const testEmails = [TEST_EMAILS_1, TEST_EMAILS_2, TEST_EMAILS_3, TEST_EMAILS_4];

export class FakeMailAdapter extends MailAdapter {
  connected: boolean = false;
  private emails: Email[] = [];

  constructor() {
    super({});
    this.loadEmails();
  }

  private async loadEmails() {
    for (const rawEmail of testEmails) {
      const email = await FakeMailAdapter.parseEmail(rawEmail);
      // Now we transform the email into our `Email` format.
      const emailToPush: Email = {
        ...email,
        hash: FakeMailAdapter.hashText(email.text ?? ""),
        id: email.messageId ?? uuid.v4(),
        read: false, // we assume all emails are unread at the beginning
      };
      this.emails.push(emailToPush);
    }
  }

  async connect() {
    this.connected = true;
    // No real connection needed in the fake adapter
  }

  async fetch(): Promise<Email[]> {
    return this.emails;
  }

  async send(email: Email): Promise<void> {
    // Just add the email to the array
    this.emails.push(email);
    console.log(`Fake email sent: ${email.subject}`);
  }

  async delete(emailId: string): Promise<void> {
    this.emails = this.emails.filter((email) => email.id !== emailId);
    console.log(`Fake email deleted: ${emailId}`);
  }

  async markAsRead(emailId: string): Promise<void> {
    const email = this.emails.find((email) => email.id === emailId);
    if (email) {
      email.read = true;
      console.log(`Fake email marked as read: ${emailId}`);
    }
  }

  async search(_context: SearchContext): Promise<Email[]> {
    // Implement a basic search algorithm here
    throw new Error("Method not implemented.");
  }

  async disconnect() {
    this.connected = false;
    // No real disconnection needed in the fake adapter
  }
}
