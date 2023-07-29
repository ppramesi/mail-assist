import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS vector;");
  await knex.schema.createTable("summary_embeddings", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("pageContent");
    table.specificType("embedding", "vector");
    table.jsonb("metadata");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("chat_history");
}
