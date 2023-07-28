import Imap from "imap";
import { simpleParser } from "mailparser";
import { Email, IMAPAuth, IMAPMailAdapter } from "./base";
import * as uuid from "uuid";

export class IMAPGmailAdapter extends IMAPMailAdapter {
  client: Imap;
  connected: boolean = false;

  constructor(auth: IMAPAuth, opts: any) {
    super(auth, opts);
    this.client = new Imap(auth);
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.client.once("ready", () => {
        this.connected = true;
        resolve();
      });
      this.client.once("error", reject);
      this.client.connect();
    });
  }

  async fetch(afterDate: Date): Promise<Email[]> {
    if (!this.connected) {
      throw new Error("Not connected");
    }

    const formattedDate = afterDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return new Promise((resolve, reject) => {
      this.client.openBox("INBOX", true, () => {
        this.client.search([["SINCE", formattedDate]], (err, results) => {
          if (err) reject(err);
          var fetch = this.client.fetch(results, {
            bodies: "",
            struct: true,
          });

          const emails: Email[] = [];

          fetch.on("message", (msg) => {
            msg.on("body", (stream) => {
              simpleParser(stream, (err, mail) => {
                if (err) reject(err);
                const to = (
                  Array.isArray(mail.to!) ? mail.to! : [mail.to!]
                ).flatMap(({ value }) =>
                  value.map((addr) => `${addr.name} <${addr.address}>`),
                );
                emails.push({
                  read: false,
                  id: uuid.v4(),
                  from: mail.from,
                  to,
                  subject: mail.subject,
                  date: mail.date,
                  text: mail.text,
                });
              });
            });
          });

          fetch.once("end", () => {
            resolve(emails);
          });
        });
      });
    });
  }

  disconnect(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
