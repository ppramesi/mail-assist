#!/usr/bin/env node
const argv = require("minimist")(process.argv.slice(2));
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
dotenv.config();

async function main() {
  let knexConfig = {
    client: "postgresql",
    connection: {
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    },
    pool: {
      min: 2,
      max: 10,
    },
  }
  if(process.env.USE_KNEX_CONFIG === "supabase"){
    knexConfig = {
      client: "postgresql",
      connection: process.env.SUPABASE_POSTGRES_URI,
      pool: {
        min: 2,
        max: 10
      }
    }
  }
  const knex = require("knex")(knexConfig);

  const { e, p, email, password } = argv;
  const emailStr = e || email;
  const passwordStr = p || password;
  if (!emailStr || !passwordStr) {
    console.log("Please provide email and password");
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(13);
  const hashedPassword = await bcrypt.hash(passwordStr, salt);
  const metakey = crypto.randomBytes(63).toString("base64");

  const hashed = await bcrypt.hash(passwordStr, salt);
  const authenticated = await bcrypt.compare(passwordStr, hashed);

  try {
    if (authenticated) {
      const userObj = {
        email: emailStr,
        password: hashedPassword,
        salt,
        metakey,
      }
      if(process.env.USE_KNEX_CONFIG === "supabase"){
        const authUrl = `${process.env.SUPABASE_URL}/auth/v1`;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
        const reqOpts = {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            Authorization: `Bearer ${serviceKey}`,
            apikey: `${serviceKey}`,
          },
          body: JSON.stringify({
            email: emailStr,
            password: passwordStr
          })
        }
  
        const fetched = await fetch(`${authUrl}/signup`, reqOpts)
        const newUser = await fetched.json()
        console.log({status: fetched.status})
        if(fetched.status !== 200){
          throw new Error(newUser)
        }
        console.log({ newUser })
        userObj.id = newUser.user.id;
      }
      await knex("users")
        .insert(userObj)
        .onConflict("email")
        .merge();
      console.log("User created successfully!! 🎉");
    } else {
      throw new Error("Ooops, something went wrong!!! 😕");
    }
  } catch (error) {
    console.error(JSON.stringify(error, null, 2))
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
