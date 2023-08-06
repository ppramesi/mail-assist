import Imap from "imap";
import { simpleParser } from "mailparser";
import { IMAPAuth, IMAPMailAdapter } from "./base.js";
import * as uuid from "uuid";
import { Source } from "mailparser";
import _ from "lodash";
import { Email } from "../schema/index.js";

export class IMAPGmailAdapter extends IMAPMailAdapter {
  declare AuthType: IMAPAuth;
  client?: Imap;
  connected: boolean = false;

  constructor(opts?: any) {
    super(opts);
  }

  async connect(auth: this["AuthType"]): Promise<void> {
    this.client = new Imap(auth);
    await new Promise<void>((resolve, reject) => {
      this.client!.once("ready", () => {
        this.connected = true;
        resolve();
      });
      this.client!.once("error", reject);
      this.client!.connect();
    });
  }

  async fetch(auth?: this["AuthType"], afterDate?: Date): Promise<Email[]> {
    if (!this.connected && _.isNil(auth)) {
      throw new Error("Auth mail adapter not set");
    }
    if (!this.connected || !_.isNil(auth)) {
      await this.connect(auth!);
    }
    let formattedDate: string;
    if (afterDate) {
      formattedDate = afterDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else {
      formattedDate = new Date(
        new Date().getTime() - 1000 * 60 * 60 * 24 * 7,
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    return new Promise((resolve, reject) => {
      this.client!.openBox("INBOX", true, () => {
        this.client!.search([["SINCE", formattedDate]], (err, results) => {
          if (err) reject(err);
          var fetch = this.client!.fetch(results, {
            bodies: "",
            struct: true,
          });

          const emails: Email[] = [];

          fetch.on("message", (msg) => {
            msg.on("body", (stream) => {
              simpleParser(stream as unknown as Source, (err, mail) => {
                if (err) reject(err);
                emails.push({
                  read: false,
                  id: uuid.v4(),
                  from: IMAPGmailAdapter.flattenAddressObjects(mail.from)!,
                  to: IMAPGmailAdapter.flattenAddressObjects(mail.to)!,
                  cc: IMAPGmailAdapter.flattenAddressObjects(mail.cc),
                  bcc: IMAPGmailAdapter.flattenAddressObjects(mail.bcc),
                  subject: mail.subject,
                  date:
                    mail?.date ??
                    new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
                  text: mail.text,
                  hash: IMAPGmailAdapter.hashText(mail.text ?? ""),
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
