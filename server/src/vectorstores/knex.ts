import {
  VectorStore,
  MaxMarginalRelevanceSearchOptions,
} from "langchain/vectorstores/base";
import { Embeddings } from "langchain/embeddings/base";
import { Document } from "langchain/document";
import { maximalMarginalRelevance } from "langchain/util/math";
import { Knex as KnexT } from "knex";
import _ from "lodash";

export interface KnexVectorStoreArgs {
  knex: KnexT;
  tableName?: string;
}

export type FilterValue = string | number | boolean;

export type ComparisonOperator =
  | { $eq: FilterValue }
  | { $gt: FilterValue }
  | { $gte: FilterValue }
  | { $lt: FilterValue }
  | { $lte: FilterValue }
  | { $not: FilterValue };

export type LogicalOperator = { $and: KnexFilter[] } | { $or: KnexFilter[] };

export type KeyValueFilter = {
  [key: string]: FilterValue | ComparisonOperator;
};

export type KnexFilter = KeyValueFilter | LogicalOperator;

const ComparisonMap = {
  $eq: "=",
  $lt: "<",
  $lte: "<=",
  $gt: ">",
  $gte: ">=",
  $not: "<>",
};

const LogicalMap = {
  $and: "AND",
  $or: "OR",
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
    this.tableName = args.tableName ?? "summary_embeddings";
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
    options?: { [x: string]: any } | undefined,
  ): Promise<void> {
    await this.ensureTableInDatabase();
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const documentRow = {
        pageContent: documents[idx].pageContent,
        embedding: embeddingString,
        metadata: documents[idx].metadata,
        user_id: options?.user_id,
      };

      return documentRow;
    });
    await this.doQuery((database) => database(this.tableName).insert(rows));
    // await this.knex(this.tableName).insert(rows);
  }

  async addDocuments(
    documents: Document<Record<string, any>>[],
    options?: { [x: string]: any } | undefined,
  ): Promise<void | string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options,
    );
  }

  async ensureTableInDatabase(): Promise<void> {
    await this.knex.raw("CREATE EXTENSION IF NOT EXISTS vector;");
    await this.knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await this.knex.raw(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "pageContent" text,
        "metadata" jsonb,
        "embedding" vector
        "user_id" uuid REFERENCES users(id)
      );
    `);
  }

  async fetchRows(
    query: number[],
    k: number,
    filter?: this["FilterType"] | undefined,
  ): Promise<SearchResult[]> {
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
    return results.rows as SearchResult[];
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"] | undefined,
  ): Promise<[Document<Record<string, any>>, number][]> {
    const rows = await this.fetchRows(query, k, filter);
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

  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>,
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.7, filter } = options;
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const results = await this.fetchRows(queryEmbedding, fetchK, filter);

    const embeddings = results.map((result) => result.embedding);
    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddings,
      lambda,
      k,
    );
    return mmrIndexes
      .filter((idx) => idx !== -1)
      .map((idx) => {
        const result = results[idx];
        return new Document({
          pageContent: result.pageContent,
          metadata: result.metadata,
        });
      });
  }

  buildSqlFilterStr(filter?: KnexFilter) {
    if (filter == null) return null;

    const buildClause = (key: string, operator: string, value: any): string => {
      const compRaw = ComparisonMap[operator as keyof typeof ComparisonMap];
      const valueType = typeof value;
      let typeCast = "";
      if (valueType === "string") {
        typeCast = "::text";
      }
      if (key !== "user_id") {
        return this.knex
          .raw(`metadata->>"${key}" ${compRaw} ?${typeCast}`, [value])
          .toString();
      } else {
        return this.knex.raw("user_id = ?", [value]).toString();
      }
    };
    const allowedOps = Object.keys(LogicalMap);

    const recursiveBuild = (filterObj: KnexFilter): string => {
      return Object.entries(filterObj)
        .map(([key, ops]) => {
          if (allowedOps.includes(key)) {
            const logicalParts = (ops as KnexFilter[]).map(recursiveBuild);
            const separator = LogicalMap[key as keyof typeof LogicalMap];
            return `(${logicalParts.join(` ${separator} `)})`;
          }

          if (typeof ops === "object" && !Array.isArray(ops)) {
            return Object.entries(ops as Record<string, any>)
              .map(([opName, value]) => {
                if (!value) return null;
                return buildClause(key, opName, value);
              })
              .filter(Boolean)
              .join(" AND ");
          }

          return buildClause(key, "$eq", ops);
        })
        .filter(Boolean)
        .join(" AND ");
    };

    const strFilter = `WHERE ${recursiveBuild(filter)}`;

    if (strFilter === "WHERE ") return null;
    return strFilter;
  }
}

export class SupabaseKnexVectorStore extends KnexVectorStore {
  jwt?: Record<string, any>;
  setJWT(jwt: Record<string, any>) {
    this.jwt = jwt;
  }

  unsetJWT() {
    this.jwt = undefined;
  }

  protected doQuery(
    query: (db: KnexT<any, any[]>) => Promise<any>,
  ): Promise<any> {
    if (this.jwt) {
      const jwtDupe = _.cloneDeep(this.jwt);
      if (jwtDupe && jwtDupe?.user_id) {
        const userId = jwtDupe.user_id;
        jwtDupe.sub = userId;
        delete jwtDupe["user_id"];
      }
      const claimsSetting = "request.jwt.claims";
      const claims = JSON.stringify(jwtDupe);
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
