import { Database } from "../databases/base.js";
import { AuthReturn, Authenticator, VerifyReturn } from "./base.js";

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
  xform?: (data: any) => any;
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

async function _request(
  fetcher: Fetch,
  method: "POST" | "GET",
  url: string,
  options?: GotrueRequestOptions,
) {
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
    { headers, noResolveJson: options?.noResolveJson },
    {},
    options?.body,
  );
  return options?.xform
    ? options?.xform(data)
    : { data: { ...data }, error: null };
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

export class SupabaseKnexAuthenticator extends Authenticator {
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

  buildAuthHeaders() {
    return {
      Authorization: `Bearer ${this.publicKey}`,
      apikey: `${this.publicKey}`,
    };
  }

  async register(email: string, password: string): Promise<AuthReturn> {
    const [{ salt, metakey, password: encryptedPass }, res] = await Promise.all(
      [
        SupabaseKnexAuthenticator.hashPasswordAndGenerateStuff(password),
        _request(fetch, "POST", `${this.authUrl}/signup`, {
          headers: this.buildAuthHeaders(),
          body: {
            email,
            password,
            data: {},
            xform: sessionTransform,
          },
        }),
      ],
    );

    await Promise.all([
      this.db.upsertUser(res.data.user.id, email, encryptedPass, salt, metakey),
      this.db.setUserSessionKey(email, res.data.session),
    ]);
    return {
      status: "ok",
      session_key: res.data.session,
    };
  }

  async login(email: string, password: string): Promise<AuthReturn> {
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
          xform: sessionTransform,
        },
      },
    );
    await this.db.setUserSessionKey(email, res.data.session);
    return {
      status: "ok",
      session_key: res.data.session,
    };
  }

  async verifyAdminToken(
    token: string,
    body?: Record<string, any>,
  ): Promise<VerifyReturn> {
    try {
      const decoded = await SupabaseKnexAuthenticator.extractInjectAdminJWT(
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
      const decoded = await SupabaseKnexAuthenticator.extractInjectSessionJWT(
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
