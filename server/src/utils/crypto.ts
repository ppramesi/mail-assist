import crypto from "crypto";

export async function generateECDHKeys() {
  const keys = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"],
  );
  
  const publicKey = await crypto.subtle.exportKey("raw", keys.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", keys.privateKey);

  return { publicKey: Buffer.from(publicKey).toString("base64"), privateKey: Buffer.from(privateKey).toString("base64") };
}

export async function computeSharedSecret(
  privateKeyBase64: string,
  publicKeyBase64: string,
) {
  const privateKeyBuffer = Buffer.from(privateKeyBase64, "base64");
  const publicKeyBuffer = Buffer.from(publicKeyBase64, "base64");

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    ["deriveBits", "deriveKey"],
  );
  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicKeyBuffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
  );
  const sharedSecretBuffer = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    256,
  );
  return Buffer.from(sharedSecretBuffer).toString("base64");
}

export function encrypt(
  message: string,
  init: string,
  salt?: string,
  secret?: string,
) {
  let key: Buffer;
  if (secret) {
    key = Buffer.from(secret, "base64").subarray(0, 32);
  } else {
    if (!process.env.TOKEN_KEY) {
      throw new Error("token key not set");
    }

    if (!salt) {
      throw new Error("salt not set");
    }

    key = crypto.pbkdf2Sync(
      Buffer.from(process.env.TOKEN_KEY, "base64"),
      Buffer.from(salt, "utf8").subarray(0, 16),
      210000,
      32,
      "sha512",
    );
  }

  const initVector = Buffer.from(init, "base64").subarray(0, 16);
  const algo = "aes-256-cbc";
  const cipher = crypto.createCipheriv(algo, key, initVector);

  let encrypted = cipher.update(message, "utf-8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

export function decrypt(
  message: string,
  init: string,
  salt?: string,
  secret?: string,
) {
  let key;
  if (secret) {
    key = Buffer.from(secret, "base64").subarray(0, 32);
  } else {
    if (!process.env.TOKEN_KEY) {
      throw new Error("token key not set");
    }

    if (!salt) {
      throw new Error("salt not set");
    }

    key = crypto.pbkdf2Sync(
      Buffer.from(process.env.TOKEN_KEY, "base64"),
      Buffer.from(salt, "utf8").subarray(0, 16),
      210000,
      32,
      "sha512",
    );
  }

  const initVector = Buffer.from(init, "base64").subarray(0, 16);
  const algo = "aes-256-cbc";
  const cipher = crypto.createDecipheriv(algo, key, initVector);

  let decrypted = cipher.update(message, "base64", "utf-8");
  decrypted += cipher.final("utf-8");
  return decrypted;
}
