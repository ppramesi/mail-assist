import jwt from "jsonwebtoken";

export function createToken(injectables: Record<string, any> = {}) {
  if (!process.env.TOKEN_KEY) {
    throw new Error("Set token key");
  }

  return jwt.sign(
    { exp: Math.floor(Date.now() / 1000) + 10, ...injectables },
    process.env.TOKEN_KEY,
  );
}
