"use client";

function b64toArrayBuffer(b64: string) {
  const binStr = atob(b64);
  const buf = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    buf[i] = binStr.charCodeAt(i);
  }
  return buf;
}

function arrayBufferToB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binStr = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr);
}

export async function encrypt(sharedSecret: string, message: string) {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const sharedSecretBuffer = b64toArrayBuffer(sharedSecret).buffer;
  const key = await crypto.subtle.importKey(
    "raw",
    sharedSecretBuffer,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const cipherText = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
    },
    key,
    data,
  );

  return {
    iv: arrayBufferToB64(iv),
    cipherText: arrayBufferToB64(cipherText),
  };
}

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

  return {
    publicKey: arrayBufferToB64(publicKey),
    privateKey: arrayBufferToB64(privateKey),
  };
}

export async function computeSharedSecret(
  privateKeyBase64: string,
  publicKeyBase64: string,
) {
  const privateKeyBuffer = b64toArrayBuffer(privateKeyBase64).buffer;
  const publicKeyBuffer = b64toArrayBuffer(publicKeyBase64).buffer;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
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

  return arrayBufferToB64(sharedSecretBuffer);
}
