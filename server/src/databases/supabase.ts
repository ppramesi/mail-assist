import _ from "lodash";
import { KnexDatabase } from "./knex.js";
import { Knex } from "knex";

export class SupabaseDatabaseDEPRECATED extends KnexDatabase {
  doQuery<T>(
    query: (db: KnexDatabase) => Promise<T>,
    options?: { jwt: Record<string, any> },
  ): Promise<T> {
    if (options && options?.jwt) {
      const optsDupe = _.cloneDeep(options);

      if (optsDupe.jwt?.user_id) {
        const userId = optsDupe.jwt.user_id;
        optsDupe.jwt.sub = userId;
        delete optsDupe.jwt["user_id"];
      }

      const claimsSetting = "request.jwt.claims";
      const claims = JSON.stringify(optsDupe.jwt);
      return this.db.transaction((trx) => {
        return trx.raw("SET ROLE authenticated;").then(() => {
          return trx
            .raw(`SELECT set_config(?, ?, true)`, [claimsSetting, claims])
            .then(() => {
              const trxWrapper = new SupabaseDatabase(trx);
              return query(trxWrapper);
            });
        });
      });
    }

    return this.db.transaction((trx) => {
      return trx.raw("SET ROLE anon;").then(() => {
        const trxWrapper = new SupabaseDatabase(trx);
        return query(trxWrapper);
      });
    });
  }
}

export class SupabaseDatabase extends KnexDatabase {
  async doQuery<T>(
    query: (db: KnexDatabase) => Promise<T>,
    options?: { jwt: Record<string, any> },
  ): Promise<T> {
    if (options?.jwt) {
      const optsDupe = _.cloneDeep(options);

      if (optsDupe.jwt?.user_id) {
        const userId = optsDupe.jwt.user_id;
        optsDupe.jwt.sub = userId;
        delete optsDupe.jwt["user_id"];
      }

      const claims = JSON.stringify(optsDupe.jwt);

      return this.db.transaction((trx) =>
        this.transactionWrapper(query, trx, "authenticated", claims),
      );
    }

    return this.db.transaction((trx) =>
      this.transactionWrapper(query, trx, "anon"),
    );
  }

  private async executeQuery<T>(
    query: (db: KnexDatabase) => Promise<T>,
    trx: Knex.Transaction,
  ) {
    const trxWrapper = new SupabaseDatabase(trx);
    return query(trxWrapper);
  }

  private async transactionWrapper<T>(
    query: (db: KnexDatabase) => Promise<T>,
    trx: Knex.Transaction,
    role: string,
    claims?: string,
  ) {
    try {
      await trx.raw(`SET ROLE ${role};`);

      if (claims) {
        await trx.raw(`SELECT set_config('request.jwt.claims', ?, true);`, [
          claims,
        ]);
      }

      const result = await this.executeQuery(query, trx);
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Transaction rolled back: ${error}`);
    }
  }
}
