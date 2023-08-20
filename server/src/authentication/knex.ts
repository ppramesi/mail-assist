import bcrypt from "bcrypt";
import _ from "lodash";
import { AuthReturn, Authenticator, VerifyReturn } from "./base.js";

export class KnexAuthenticator extends Authenticator {
  async register(email: string, password: string): Promise<AuthReturn> {
    try {
      const {
        salt,
        metakey,
        password: encryptedPass,
      } = await KnexAuthenticator.hashPasswordAndGenerateStuff(password);
      await this.db.createNewUser(email, encryptedPass, salt, metakey);
      const newUser = await this.db.getUserByEmail(email);
      const sessionKey = KnexAuthenticator.signJWT(email, newUser!.id);
      await this.db.setUserSessionKey(email, sessionKey);
      return {
        status: "ok",
        session_key: sessionKey,
      };
    } catch (error) {
      return {
        status: "error",
        error: `error-{${error}}`,
      };
    }
  }

  async login(email: string, password: string): Promise<AuthReturn> {
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
    const sessionKey = KnexAuthenticator.signJWT(email, id);
    await this.db.setUserSessionKey(email, sessionKey);
    return {
      status: "ok",
      session_key: sessionKey,
    };
  }

  async verifyAdminToken(
    token: string,
    body?: Record<string, any>,
  ): Promise<VerifyReturn> {
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
        error: "verify-admin-token-failed",
      };
    }
  }

  async verifySessionToken(
    token: string,
    body?: object,
  ): Promise<VerifyReturn> {
    try {
      const decoded = await KnexAuthenticator.extractInjectSessionJWT(
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
        error: "verify-session-token-failed",
      };
    }
  }
}
