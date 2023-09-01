import jwt from "jsonwebtoken";
import { Database } from "../databases/base.js";
import { JWTSignReturn } from "./base.js";
import { KnexAuthenticator } from "./knex.js";

type Fetch = typeof fetch;

interface FetchOptions {
  headers?: {
    [key: string]: string;
  };
  noResolveJson?: boolean;
}

interface FetchParameters {
  signal?: AbortSignal;
}

interface GotrueRequestOptions extends FetchOptions {
  jwt?: string;
  redirectTo?: string;
  body?: object;
  query?: { [key: string]: string };
  /**
   * Function that transforms api response from gotrue into a desirable / standardised format
   */
  xform: (data: any) => any;
}

const _getRequestParams = (
  method: "POST" | "GET",
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object,
) => {
  const params: { [k: string]: any } = {
    method,
    headers: options?.headers || {},
  };

  if (method === "GET") {
    return params;
  }

  params.headers = {
    "Content-Type": "application/json;charset=UTF-8",
    ...options?.headers,
  };
  params.body = JSON.stringify(body);
  return { ...params, ...parameters };
};

async function _request<
  Y extends GotrueRequestOptions,
  T extends ReturnType<Y["xform"]>,
>(fetcher: Fetch, method: "POST" | "GET", url: string, options: Y): Promise<T> {
  try {
    const headers = { ...options?.headers };
    if (options?.jwt) {
      headers["Authorization"] = `Bearer ${options.jwt}`;
    }
    const qs = options?.query ?? {};
    if (options?.redirectTo) {
      qs["redirect_to"] = options.redirectTo;
    }
    const queryString = Object.keys(qs).length
      ? "?" + new URLSearchParams(qs).toString()
      : "";
    const data = await _handleRequest(
      fetcher,
      method,
      url + queryString,
      { headers },
      {},
      options?.body,
    );
    return options.xform(data);
  } catch (error) {
    throw error;
  }
}

async function _handleRequest(
  fetcher: Fetch,
  method: "POST" | "GET",
  url: string,
  options?: FetchOptions,
  parameters?: FetchParameters,
  body?: object,
): Promise<any> {
  const requestParams = _getRequestParams(method, options, parameters, body);

  let result: any;

  try {
    result = await fetcher(url, requestParams);
  } catch (e) {
    console.error(e);

    // fetch failed, likely due to a network or CORS error
    throw new Error("bad bad bad");
  }

  if (!result.ok) {
    throw new Error("bad bad bad");
  }

  if (options?.noResolveJson) {
    return result;
  }

  try {
    return await result.json();
  } catch (e: any) {
    throw new Error("bad bad bad");
  }
}

function sessionTransform(data: any) {
  let session = { ...data };
  const user: Record<string, any> = data.user ?? (data as Record<string, any>);
  return { data: { session, user } };
}

export class SupabaseKnexAuthenticator extends KnexAuthenticator {
  authUrl: string;
  publicKey: string;
  constructor(db: Database) {
    super(db);
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLIC_KEY) {
      throw new Error(
        "Please set process.env.SUPABASE_PUBLIC_KEY & process.env.SUPABASE_URL",
      );
    }
    this.authUrl = `${process.env.SUPABASE_URL}/auth/v1`;
    this.publicKey = process.env.SUPABASE_PUBLIC_KEY;
  }

  buildAuthHeaders(jwt?: string) {
    return {
      Authorization: `Bearer ${jwt ?? this.publicKey}`,
      apikey: `${this.publicKey}`,
    };
  }

  async register(email: string, password: string): Promise<JWTSignReturn> {
    try {
      const [{ salt, metakey, password: encryptedPass }, res] =
        await Promise.all([
          SupabaseKnexAuthenticator.hashPasswordAndGenerateStuff(password),
          _request(fetch, "POST", `${this.authUrl}/signup`, {
            headers: this.buildAuthHeaders(),
            body: {
              email,
              password,
              data: {},
            },
            xform: sessionTransform,
          }),
        ]);

      await Promise.all([
        this.db.upsertUser(
          res.data.user.id,
          email,
          encryptedPass,
          salt,
          metakey,
        ),
        this.db.setUserSessionKey(email, res.data.session.refresh_token),
      ]);
      const refreshTokenToken = jwt.sign(
        { token_id: res.data.session.refresh_token },
        process.env.TOKEN_KEY!,
        {
          expiresIn: "7d",
        },
      );
      return {
        status: "ok",
        tokens: {
          session_token: res.data.session.access_token,
          refresh_token: refreshTokenToken,
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
    try {
      const res = await _request(
        fetch,
        "POST",
        `${this.authUrl}/token?grant_type=password`,
        {
          headers: this.buildAuthHeaders(),
          body: {
            email,
            password,
            data: {},
          },
          xform: sessionTransform,
        },
      );
      const refreshTokenToken = jwt.sign(
        { token_id: res.data.session.refresh_token },
        process.env.TOKEN_KEY!,
        {
          expiresIn: "7d",
        },
      );
      await this.db.setUserSessionKey(email, refreshTokenToken);
      return {
        status: "ok",
        tokens: {
          session_token: res.data.session.access_token,
          refresh_token: refreshTokenToken,
        },
      };
    } catch (error) {
      return {
        status: "error",
        error: `login-failed-{${error}}`,
      };
    }
  }

  async logout(
    accessToken: string,
  ): Promise<{ status: "ok" } | { status: "error" }> {
    try {
      await _request(fetch, "POST", `${this.authUrl}/logout?scope=global`, {
        headers: this.buildAuthHeaders(accessToken),
        xform: () => {},
      });
      await super.logout(accessToken);
      return {
        status: "ok",
      };
    } catch (error) {
      return {
        status: "error",
      };
    }
  }

  async refreshToken(
    _accessToken: string,
    refreshToken: string,
  ): Promise<JWTSignReturn> {
    try {
      const user = await this.db.getUserBySessionKey(refreshToken);
      if (!user) {
        throw new Error("Invalid refresh token");
      }
      const verified = jwt.verify(
        refreshToken,
        process.env.TOKEN_KEY!,
      ) as jwt.JwtPayload;
      const res = await _request(
        fetch,
        "POST",
        `${this.authUrl}/token?grant_type=refresh_token`,
        {
          headers: this.buildAuthHeaders(),
          body: { refresh_token: verified.token_id },
          xform: sessionTransform,
        },
      );
      await this.db.setUserSessionKey(res.data.user.email, verified.token_id);
      const refreshTokenToken = jwt.sign(
        { token_id: res.data.session.refresh_token },
        process.env.TOKEN_KEY!,
        {
          expiresIn: "7d",
        },
      );
      return {
        status: "ok",
        tokens: {
          session_token: res.data.session.access_token,
          refresh_token: refreshTokenToken,
        },
      };
    } catch (error) {
      return {
        status: "error",
        error: `refresh-token-failed-{${error}}`,
      };
    }
  }
}
