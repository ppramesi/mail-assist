import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("emails", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("hash").unique();
    table.specificType("from", "text[]");
    table.specificType("to", "text[]");
    table.specificType("cc", "text[]").nullable();
    table.specificType("bcc", "text[]").nullable();
    table.string("subject", 1023);
    table.text("text");
    table.date("date");
    table.boolean("read");
    table.text("summary").nullable();
    table.string("status").nullable();
    table.jsonb("extracted_info").nullable();
    table.uuid("user_id").references("id").inTable("users");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("emails");
}
