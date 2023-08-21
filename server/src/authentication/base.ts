import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import _ from "lodash";
import { Database } from "../databases/base.js";

export type ErrorType = {
  status: "error";
  error: unknown;
};

export type AuthReturn =
  | {
      status: "ok";
      session_key: string;
    }
  | ErrorType;

export type VerifyReturn =
  | {
      status: "ok";
      jwt: Record<string, any>;
    }
  | ErrorType;

export abstract class Authenticator {
  protected db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  abstract register(email: string, password: string): Promise<AuthReturn>;

  abstract login(email: string, password: string): Promise<AuthReturn>;

  abstract verifyAdminToken(token: string): Promise<VerifyReturn>;

  abstract verifySessionToken(token: string): Promise<VerifyReturn>;

  static async hashPasswordAndGenerateStuff(password: string) {
    const salt = await bcrypt.genSalt(13);
    const hashedPassword = await bcrypt.hash(password, salt);
    const metakey = crypto.randomBytes(63).toString("base64");
    return { salt, metakey, password: hashedPassword };
  }

  static signJWT(email: string, userId: string) {
    return jwt.sign(
      {
        email,
        user_id: userId,
        role: "authenticated",
        nonce: Math.random().toString(36).substring(2),
      },
      process.env.TOKEN_KEY!,
      {
        expiresIn: "10h",
        algorithm: "HS256",
        header: {
          typ: "JWT",
          alg: "HS256",
        },
      },
    );
  }

  static extractInjectSessionJWT(token: string, obj?: Record<string, any>) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.TOKEN_KEY!,
      ) as jwt.JwtPayload;
      if (obj && decoded && _.isObject(decoded)) {
        Object.entries(decoded).forEach(([key, value]) => {
          obj[key] = value;
        });
      }
      return decoded;
    } catch (err) {
      throw err;
    }
  }

  static extractInjectAdminJWT(token: string, obj?: Record<string, any>) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.ADMIN_KEY!,
      ) as jwt.JwtPayload;
      if (obj && decoded && _.isObject(decoded)) {
        Object.entries(decoded).forEach(([key, value]) => {
          obj[key] = value;
        });
      }
      return decoded;
    } catch (err) {
      throw err;
    }
  }
}
