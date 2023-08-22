import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import _ from "lodash";
import * as uuid from "uuid";
import { Database } from "../databases/base.js";

export type ErrorType = {
  status: "error";
  error: unknown;
};

export type JWTSignReturn =
  | {
      status: "ok";
      tokens: {
        session_token: string;
        refresh_token: string;
      };
    }
  | ErrorType;

export type JWTVerifyReturn =
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

  abstract register(email: string, password: string): Promise<JWTSignReturn>;

  abstract login(email: string, password: string): Promise<JWTSignReturn>;

  abstract refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<JWTSignReturn>;

  abstract verifyAdminToken(
    token: string,
    injectable?: Record<string, any>,
  ): Promise<JWTVerifyReturn>;

  abstract verifySessionToken(
    token: string,
    injectable?: Record<string, any>,
  ): Promise<JWTVerifyReturn>;

  static async hashPasswordAndGenerateStuff(password: string) {
    const salt = await bcrypt.genSalt(13);
    const hashedPassword = await bcrypt.hash(password, salt);
    const metakey = crypto.randomBytes(63).toString("base64");
    return { salt, metakey, password: hashedPassword };
  }

  static signJWT(email: string, userId: string) {
    const id = uuid.v4();
    const accessToken = jwt.sign(
      {
        email,
        user_id: userId,
        role: "authenticated",
        nonce: Math.random().toString(36).substring(2),
      },
      process.env.TOKEN_KEY!,
      {
        expiresIn: 60 * 10,
        algorithm: "HS256",
        header: {
          typ: "JWT",
          alg: "HS256",
        },
        jwtid: id,
      },
    );

    const refreshToken = jwt.sign({ token_id: id }, process.env.TOKEN_KEY!, {
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
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
