import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("temp_keys", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("public_key").unique();
    table.string("private_key").unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("temp_keys");
}
