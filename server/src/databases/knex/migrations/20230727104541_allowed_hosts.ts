import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("allowed_hosts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("host").primary();
    table.enum("type", ["string", "regex"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("allowed_hosts");
}
