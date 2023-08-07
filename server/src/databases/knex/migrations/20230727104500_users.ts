import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("email").unique();
    table.string("salt");
    table.string("password");
    table.string("metakey");
    table.string("session_key").nullable();

    table.string("imap_password").nullable();
    table.string("imap_host").nullable();
    table.string("imap_port").nullable();
    table.jsonb("imap_settings").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("users");
}
