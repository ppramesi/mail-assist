import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("potential_replies", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("intention");
    table.string("reply_text");
    table.string("summary");
    table.uuid("email_id").references("id").inTable("emails");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("potential_replies");
}