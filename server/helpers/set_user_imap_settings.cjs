#!/usr/bin/env node
const argv = require("minimist")(process.argv.slice(2));
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
dotenv.config();

function encrypt(message, init) {
  const key = Buffer.from(process.env.TOKEN_KEY, "base64").subarray(0, 32);
  
  const initVector = Buffer.from(init, "base64").subarray(0, 16);
  const algo = "aes256";
  const cipher = crypto.createCipheriv(algo, key, initVector);
  let encrypted = cipher.update(message, "utf-8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function decrypt(message, init) {
  const key = Buffer.from(process.env.TOKEN_KEY, "base64").subarray(0, 32);
  const initVector = Buffer.from(init, "base64").subarray(0, 16);
  const algo = "aes256";
  const cipher = crypto.createDecipheriv(algo, key, initVector);

  let decrypted = cipher.update(message, "base64", "utf-8");
  decrypted += cipher.final("utf-8");
  return decrypted;
}

async function main(){
  const knex = require("knex")({
    client: "postgresql",
    connection: {
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD
    },
    pool: {
      min: 2,
      max: 10
    }
  });
  
  const { e, p, email, password } = argv;
  const emailStr = e || email;
  const passwordStr = p || password;
  if(!emailStr || !passwordStr) {
    console.error("Please provide email and password");
    process.exit(1);
  }

  const { password: encryptedPass, metakey } = await knex("users")
    .where({ 
      email: emailStr
    })
    .select("password")
    .select("metakey")
    .first();

  const authenticated = await bcrypt.compare(passwordStr, encryptedPass);
  if(!authenticated){
    console.error("Auth failed!")
    return;
  }

  const { imap_pass: imapPass, imap_host: imapHost, imap_port: imapPort } = argv
  console.log(imapHost, imapPass, imapPort)

  if(!imapPass || !imapHost || !imapPort){
    console.error("IMAP config missing")
    return;
  }

  const encryptedPassword = encrypt(imapPass, metakey)
  try {
    await knex("users")
      .where({
        email: emailStr
      })
      .update({
        email_password: encryptedPassword,
        email_host: imapHost,
        email_port: imapPort,
        imap_settings: {
          tls: true,
          tlsOptions: {
            rejectUnauthorized: false,
          }
        }
      })
    return;
  } catch (error) {
    console.error("update fucked up:", error)
    return
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});