import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("contexts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("key");
    table.string("value");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("contexts");
}
