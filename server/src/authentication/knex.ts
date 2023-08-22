import bcrypt from "bcrypt";
import _ from "lodash";
import jwt from "jsonwebtoken";
import { Authenticator, JWTSignReturn, JWTVerifyReturn } from "./base.js";

export class KnexAuthenticator extends Authenticator {
  async register(email: string, password: string): Promise<JWTSignReturn> {
    try {
      const {
        salt,
        metakey,
        password: encryptedPass,
      } = await KnexAuthenticator.hashPasswordAndGenerateStuff(password);
      await this.db.createNewUser(email, encryptedPass, salt, metakey);
      const newUser = await this.db.getUserByEmail(email);
      const tokens = KnexAuthenticator.signJWT(email, newUser!.id);
      await this.db.setUserSessionKey(email, tokens.refreshToken);
      return {
        status: "ok",
        tokens: {
          session_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        },
      };
    } catch (error) {
      return {
        status: "error",
        error: `register-failed-{${error}}`,
      };
    }
  }

  async login(email: string, password: string): Promise<JWTSignReturn> {
    const authData = await this.db.getUserAuth(email);
    if (!authData) {
      return {
        status: "error",
        error: "user-not-found",
      };
    }

    const authenticated = await bcrypt.compare(password, authData.password);
    if (!authenticated) {
      return {
        status: "error",
        error: "wrong-password",
      };
    }

    const userData = await this.db.getUserByEmail(email);
    if (!userData) {
      return {
        status: "error",
        error: "what-the-fuck",
      };
    }

    const { id } = userData;
    const tokens = KnexAuthenticator.signJWT(email, id);
    await this.db.setUserSessionKey(email, tokens.refreshToken);
    return {
      status: "ok",
      tokens: {
        session_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      },
    };
  }

  async refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<JWTSignReturn> {
    const user = await this.db.getUserBySessionKey(refreshToken);
    if (!user) {
      throw new Error("Invalid refresh token");
    }
    try {
      const accDec = jwt.verify(
        accessToken,
        process.env.TOKEN_KEY!,
      ) as jwt.JwtPayload;
      const refDec = jwt.verify(
        refreshToken,
        process.env.TOKEN_KEY!,
      ) as jwt.JwtPayload;

      if (accDec.jti === refDec.token_id) {
        const { email, id } = accDec;
        const tokens = KnexAuthenticator.signJWT(email, id);
        await this.db.setUserSessionKey(email, tokens.refreshToken);
        return {
          status: "ok",
          tokens: {
            session_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          },
        };
      } else {
        return {
          status: "error",
          error: "refresh-token-failed",
        };
      }
    } catch (error) {
      return {
        status: "error",
        error: "refresh-token-failed",
      };
    }
  }

  async verifyAdminToken(
    token: string,
    body?: Record<string, any>,
  ): Promise<JWTVerifyReturn> {
    try {
      const decoded = await KnexAuthenticator.extractInjectAdminJWT(
        token,
        body,
      );
      return {
        status: "ok",
        jwt: decoded,
      };
    } catch (err) {
      return {
        status: "error",
        error: `verify-admin-token-failed-{${err}}`,
      };
    }
  }

  async verifySessionToken(
    token: string,
    body?: object,
  ): Promise<JWTVerifyReturn> {
    try {
      const unverifiedDecoded = jwt.decode(token);
      if (
        !unverifiedDecoded ||
        typeof unverifiedDecoded === "string" ||
        !unverifiedDecoded.email
      ) {
        return {
          status: "error",
          error: `malformed-jwt`,
        };
      }

      const user = await this.db.getUserByEmail(unverifiedDecoded.email);
      if (!user) {
        return {
          status: "error",
          error: `user-not-found`,
        };
      }

      const decoded = KnexAuthenticator.extractInjectSessionJWT(token, body);
      return {
        status: "ok",
        jwt: decoded,
      };
    } catch (err) {
      return {
        status: "error",
        error: `verify-session-token-failed-{${err}}`,
      };
    }
  }
}
