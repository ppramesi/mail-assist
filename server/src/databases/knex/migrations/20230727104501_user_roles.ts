import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("user_roles", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("user_id").references("id").inTable("users");
    table.enum("role", ["admin", "user"]);
    table.unique(["user_id", "role"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("user_roles");
}
