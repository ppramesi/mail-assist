import crypto from "crypto";

export function encrypt(message: string, init: string, salt: string) {
  if (!process.env.TOKEN_KEY) {
    throw new Error("token key not set");
  }

  const key = crypto.pbkdf2Sync(
    Buffer.from(process.env.TOKEN_KEY, "base64"),
    Buffer.from(salt, "utf8").subarray(0, 16),
    210000,
    32,
    "sha512",
  );
  const initVector = Buffer.from(init, "base64").subarray(0, 16);
  const algo = "aes256";
  const cipher = crypto.createCipheriv(algo, key, initVector);
  let encrypted = cipher.update(message, "utf-8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

export function decrypt(message: string, init: string, salt: string) {
  if (!process.env.TOKEN_KEY) {
    throw new Error("token key not set");
  }

  const key = crypto.pbkdf2Sync(
    Buffer.from(process.env.TOKEN_KEY, "base64"),
    Buffer.from(salt, "utf8").subarray(0, 16),
    210000,
    32,
    "sha512",
  );
  const initVector = Buffer.from(init, "base64").subarray(0, 16);
  const algo = "aes256";
  const cipher = crypto.createDecipheriv(algo, key, initVector);

  let decrypted = cipher.update(message, "base64", "utf-8");
  decrypted += cipher.final("utf-8");
  return decrypted;
}
