#!/usr/bin/env node
const argv = require("minimist")(process.argv.slice(2));
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
dotenv.config();
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
    console.log("Please provide email and password");
    process.exit(1);
  }
  
  const salt = await bcrypt.genSalt(13);
  const hashedPassword = await bcrypt.hash(passwordStr, salt);
  const metakey = crypto.randomBytes(63).toString("base64");

  const hashed = await bcrypt.hash(passwordStr, salt);
  const authenticated = await bcrypt.compare(passwordStr, hashed);

  if(authenticated){
    await knex("users")
      .insert({
        email: emailStr,
        password: hashedPassword,
        salt,
        metakey,
      })
      .onConflict("email")
      .merge();
    console.log("User created successfully!! 🎉");
  }else{
    throw new Error("Ooops, something went wrong!!! 😕");
  }
}
main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});