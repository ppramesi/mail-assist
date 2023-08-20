import _ from "lodash";
import { KnexDatabase } from "./knex.js";

export class SupabaseDatabase extends KnexDatabase {
  doQuery<T>(
    query: (db: KnexDatabase) => Promise<T>,
    options?: { jwt: Record<string, any> },
  ): Promise<T> {
    if (options && options?.jwt) {
      const optsDupe = _.cloneDeep(options);
      if (optsDupe.jwt && optsDupe.jwt?.user_id) {
        const userId = optsDupe.jwt.user_id;
        optsDupe.jwt.sub = userId;
        delete optsDupe.jwt["user_id"];
      }
      const claimsSetting = "request.jwt.claims";
      const claims = JSON.stringify(optsDupe.jwt);
      return this.db.transaction((trx) => {
        return trx
          .raw(`SELECT set_config(?, ?, true)`, claimsSetting, claims)
          .then(() => {
            const trxWrapper = new SupabaseDatabase(trx);
            return query(trxWrapper);
          });
      });
    }

    return query(this);
  }
}
