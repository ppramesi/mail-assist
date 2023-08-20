import type { Knex } from "knex";
import dotenv from "dotenv";
dotenv.config();

// Update with your config settings.

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "postgresql",
    connection: {
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/databases/knex/migrations",
      loadExtensions: [".js", ".ts"]
    },
    seeds: {
      directory: "./src/databases/knex/seeds"
    }
  },

  staging: {
    client: "postgresql",
    connection: {
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/databases/knex/migrations",
      loadExtensions: [".js", ".ts"]
    },
    seeds: {
      directory: "./src/databases/knex/seeds"
    }
  },

  production: {
    client: "postgresql",
    connection: {
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/databases/knex/migrations",
      loadExtensions: [".js", ".ts"]
    },
    seeds: {
      directory: "./src/databases/knex/seeds"
    }
  },

  supabase: {
    client: "postgresql",
    connection: {
      database: process.env.SUPABASE_POSTGRES_DB,
      user: process.env.SUPABASE_POSTGRES_USER,
      password: process.env.SUPABASE_POSTGRES_PASSWORD
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/databases/supabase/migrations",
      loadExtensions: [".js", ".ts"]
    },
    seeds: {
      directory: "./src/databases/supabase/seeds"
    }
  }


};

export default config;
