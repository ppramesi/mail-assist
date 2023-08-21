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
