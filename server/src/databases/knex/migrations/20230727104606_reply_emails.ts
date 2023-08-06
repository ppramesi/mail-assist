import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("reply_emails", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.text("intention");
    table.text("reply_text");
    table.text("summary");
    table.uuid("email_id").references("id").inTable("emails");
    table.uuid("user_id").references("id").inTable("users");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("reply_emails");
}
