import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("emails", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("hash").unique();
    table.specificType("from", "text[]");
    table.specificType("to", "text[]");
    table.specificType("cc", "text[]").nullable();
    table.specificType("bcc", "text[]").nullable();
    table.string("subject");
    table.string("text");
    table.date("date");
    table.boolean("read");
    table.string("summary");
    table.string("status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("emails");
}
