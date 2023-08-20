import { VectorStore } from "langchain/vectorstores/base";
import { Embeddings } from "langchain/embeddings/base";
import { Document } from "langchain/document";
import { Knex as KnexT } from "knex";
import _ from "lodash";

export interface KnexVectorStoreArgs {
  knex: KnexT;
  tableName: string;
}

const OpMap = {
  equals: "=",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  not: "<>",
};

export type KnexFilter<
  TModel extends Record<string, unknown> = Record<string, unknown>,
> = {
  [K in keyof TModel]?: {
    equals?: TModel[K];
    lt?: TModel[K];
    lte?: TModel[K];
    gt?: TModel[K];
    gte?: TModel[K];
    not?: TModel[K];
  };
};

export type SearchResult = {
  pageContent: string;
  metadata: Record<string, any>;
  embedding: number[];
  _distance: number;
};

export class KnexVectorStore extends VectorStore {
  declare FilterType: KnexFilter;
  knex: KnexT;
  tableName: string;
  constructor(embeddings: Embeddings, args: KnexVectorStoreArgs) {
    super(embeddings, args);
    this.embeddings = embeddings;
    this.knex = args.knex;
    this.tableName = args.tableName;
  }

  _vectorstoreType(): string {
    return "knex";
  }

  protected doQuery(query: (db: KnexT) => Promise<any>) {
    return query(this.knex);
  }

  async addVectors(
    vectors: number[][],
    documents: Document<Record<string, any>>[],
    _options?: { [x: string]: any } | undefined,
  ): Promise<void> {
    await this.ensureTableInDatabase();
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const documentRow = {
        pageContent: documents[idx].pageContent,
        embedding: embeddingString,
        metadata: documents[idx].metadata,
      };

      return documentRow;
    });
    await this.doQuery((database) => database(this.tableName).insert(rows));
    // await this.knex(this.tableName).insert(rows);
  }

  async addDocuments(
    documents: Document<Record<string, any>>[],
    _options?: { [x: string]: any } | undefined,
  ): Promise<void | string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
    );
  }

  async ensureTableInDatabase(): Promise<void> {
    await this.doQuery(async (database) => {
      await database.raw("CREATE EXTENSION IF NOT EXISTS vector;");
      await database.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      await database.raw(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
          "pageContent" text,
          "metadata" jsonb,
          "embedding" vector
        );
      `);
    });
    // await this.knex.raw("CREATE EXTENSION IF NOT EXISTS vector;");
    // await this.knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // await this.knex.raw(`
    //   CREATE TABLE IF NOT EXISTS ${this.tableName} (
    //     "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    //     "pageContent" text,
    //     "metadata" jsonb,
    //     "embedding" vector
    //   );
    // `);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"] | undefined,
  ): Promise<[Document<Record<string, any>>, number][]> {
    const vector = `[${query.join(",")}]`;
    const queryStr = [
      this.knex
        .raw(
          `SELECT *, embedding <=> ?::vector as "_distance" FROM ${this.tableName}`,
          [vector],
        )
        .toString(),
      this.buildSqlFilterStr(filter),
      this.knex.raw(`ORDER BY "_distance" ASC LIMIT ?;`, [k]).toString(),
    ]
      .filter((x) => x != null)
      .join(" ");
    const results = await this.doQuery((database) => {
      return database.raw(queryStr);
    });
    // const results = await this.knex.raw(queryStr);
    const rows = results.rows as SearchResult[];
    return rows.map((row) => {
      return [
        new Document({
          pageContent: row.pageContent,
          metadata: row.metadata,
        }),
        row._distance,
      ];
    });
  }

  buildSqlFilterStr(filter?: KnexFilter) {
    if (filter == null) return null;
    return `WHERE ${Object.entries(filter)
      .flatMap(([key, ops]) =>
        Object.entries(ops as Record<string, any>).map(([opName, value]) => {
          const opRaw = OpMap[opName as keyof typeof OpMap];
          return this.knex
            .raw(`metadata ->> "${key}" ${opRaw} ?`, [value])
            .toString();
        }),
      )
      .join(" AND ")}`;
  }
}

export class SupabaseKnexVectorStore extends KnexVectorStore {
  protected doQuery(
    query: (db: KnexT<any, any[]>) => Promise<any>,
    options?: { jwt: Record<string, any> },
  ): Promise<any> {
    if (options && options?.jwt) {
      const optsDupe = _.cloneDeep(options);
      if (optsDupe.jwt && optsDupe.jwt?.user_id) {
        const userId = optsDupe.jwt.user_id;
        optsDupe.jwt.sub = userId;
        delete optsDupe.jwt["user_id"];
      }
      const claimsSetting = "request.jwt.claims";
      const claims = JSON.stringify(optsDupe.jwt);
      return this.knex.transaction((trx) => {
        return trx
          .raw(`SELECT set_config(?, ?, true)`, claimsSetting, claims)
          .then(() => {
            return query(trx);
          });
      });
    }

    return query(this.knex);
  }
}
