import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("emails", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("email").unique();
    table.string("salt");
    table.string("password");
    table.string("metakey");
    table.string("session_key")
  });
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("emails");
}

