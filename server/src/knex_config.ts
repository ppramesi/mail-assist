import type { Knex } from "knex";

export function buildConfig(env: NodeJS.ProcessEnv): {
  [key: string]: Knex.Config;
} {
  return {
    development: {
      client: "postgresql",
      connection: {
        database: env.POSTGRES_DB,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
      },
      pool: {
        min: 2,
        max: 10,
      },
      migrations: {
        tableName: "knex_migrations",
        directory: "./src/databases/knex/migrations",
        loadExtensions: [".js", ".ts"],
      },
      seeds: {
        directory: "./src/databases/knex/seeds",
      },
    },

    staging: {
      client: "postgresql",
      connection: {
        database: env.POSTGRES_DB,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
      },
      pool: {
        min: 2,
        max: 10,
      },
      migrations: {
        tableName: "knex_migrations",
        directory: "./src/databases/knex/migrations",
        loadExtensions: [".js", ".ts"],
      },
      seeds: {
        directory: "./src/databases/knex/seeds",
      },
    },

    production: {
      client: "postgresql",
      connection: {
        database: env.POSTGRES_DB,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
      },
      pool: {
        min: 2,
        max: 10,
      },
      migrations: {
        tableName: "knex_migrations",
        directory: "./src/databases/knex/migrations",
        loadExtensions: [".js", ".ts"],
      },
      seeds: {
        directory: "./src/databases/knex/seeds",
      },
    },

    supabase: {
      client: "postgresql",
      connection: env.SUPABASE_POSTGRES_URI,
      pool: {
        min: 2,
        max: 10,
      },
      migrations: {
        tableName: "knex_migrations",
        directory: "./src/databases/knex/migrations",
        loadExtensions: [".js", ".ts"],
      },
      seeds: {
        directory: "./src/databases/knex/seeds",
      },
    },
  };
}
