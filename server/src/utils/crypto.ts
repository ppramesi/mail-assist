import crypto from "crypto";

export function encrypt(message: string, init: string) {
  const textEncoder = new TextEncoder();
  const key = textEncoder.encode(process.env.TOKEN_KEY);
  const initVector = textEncoder.encode(init);
  const algo = "aes-256-cbc";
  const cipher = crypto.createCipheriv(algo, key, initVector);
  let encrypted = cipher.update(message, "utf-8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

export function decrypt(message: string, init: string) {
  const textEncoder = new TextEncoder();
  const key = textEncoder.encode(process.env.TOKEN_KEY);
  const initVector = textEncoder.encode(init);
  const algo = "aes-256-cbc";
  const cipher = crypto.createDecipheriv(algo, key, initVector);

  let decrypted = cipher.update(message, "base64", "utf-8");
  decrypted += cipher.final("utf-8");
  return decrypted;
}
