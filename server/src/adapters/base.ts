import { simpleParser, AddressObject } from "mailparser";
import crypto from "crypto";
import { Email, SearchContext } from "../schema/index.js";

export type FetchOpts = {};

export abstract class BaseMailAdapter {
  declare AuthType: { [k: string]: any };
  abstract connected: boolean;
  constructor(public opts?: FetchOpts) {}
  abstract connect(auth?: this["AuthType"]): Promise<void>;
  abstract fetch(afterDate?: Date, auth?: this["AuthType"]): Promise<Email[]>; // where `Email` is a class or interface you define
  abstract disconnect(): Promise<void>;

  static hashText(text: string) {
    return crypto
      .createHash("SHA256")
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

  static flattenAddressObjects(
    addressObjects?: AddressObject | AddressObject[],
  ) {
    if (!addressObjects) return undefined;
    return (
      Array.isArray(addressObjects) ? addressObjects : [addressObjects]
    ).flatMap(({ value }) =>
      value.map((addr) => `${addr.name} <${addr.address}>`),
    );
  }
}

export abstract class AdvancedMailAdapter extends BaseMailAdapter {
  abstract send(email: Email): Promise<void>;
  abstract delete(emailId: string): Promise<void>;
  abstract markAsRead(emailId: string): Promise<void>;
  abstract search(context: SearchContext): Promise<Email[]>; // where `SearchContext` is a class or interface you define
}

export type IMAPAuth = {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  tlsOptions?: Record<string, unknown>;
};

export abstract class IMAPMailAdapter extends BaseMailAdapter {
  auth: IMAPAuth;
  constructor(auth: IMAPAuth, opts?: FetchOpts) {
    super(opts);
    this.auth = auth;
  }
}
