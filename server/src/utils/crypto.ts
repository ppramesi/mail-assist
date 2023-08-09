import crypto from "crypto";

export function generateECDHKeys() {
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey("base64");
  const privateKey = ecdh.getPrivateKey("base64");

  return { publicKey, privateKey };
}

export function computeSharedSecret(
  privateKeyBase64: string,
  publicKeyBase64: string,
) {
  const privateKey = Buffer.from(privateKeyBase64, "base64");
  const publicKey = Buffer.from(publicKeyBase64, "base64");
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.setPrivateKey(privateKey);
  return ecdh.computeSecret(publicKey, "base64");
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
