import jwt from "jsonwebtoken";

export function createToken(injectables: Record<string, any> = {}) {
  if (!process.env.TOKEN_KEY) {
    throw new Error("Set token key");
  }

  return jwt.sign(
    { exp: Math.floor(Date.now() / 1000) + 36000, ...injectables },
    process.env.TOKEN_KEY,
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

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok === false) {
    throw new Error("Not ok!");
  }
  const { session_token: sessionToken, refresh_token: refreshToken } =
    await res.json();
  if (!sessionToken) {
    throw new Error("Session undefined");
  }
  return { sessionToken, refreshToken };
}

export async function refresh(sessionToken: string, refreshToken: string) {
  const refreshedRes = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_token: sessionToken,
      refresh_token: refreshToken,
    }),
  });
  const { session_token: newSessionToken, refresh_token: newRefreshToken } =
    await refreshedRes.json();
  return { sessionToken: newSessionToken, refreshToken: newRefreshToken };
}
