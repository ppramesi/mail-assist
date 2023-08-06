import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("chat_history", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("email_id").references("id").inTable("emails");
    table.uuid("reply_id").references("id").inTable("reply_emails");
    table.jsonb("chat_messages");
    table.uuid("user_id").references("id").inTable("users");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("chat_history");
}
