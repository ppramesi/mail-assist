import Knex from "knex";
import { KnexDatabase } from "./databases/knex.js";
import { MailGPTAPIServer, MailGPTServer } from "./mail_gpt.js";
import { KnexVectorStore } from "./vectorstores/knex.js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import dotenv from "dotenv";
import { CallerScheduler } from "./scheduler/caller.js";
import { IMAPGmailAdapter } from "./adapters/gmail.js";
import { KnexAuthenticator } from "./authentication/knex.js";
import { buildConfig } from "./knex_config.js";
import { SupabaseAuthorization } from "./authorization/supabase.js";

dotenv.config();

console.log("mail-assist starting!");

const mailAdapter = new IMAPGmailAdapter();

const KnexConfig = buildConfig(process.env);

const knex = Knex.knex(
  KnexConfig[process.env.USE_KNEX_CONFIG ?? "development"],
);

const authorizer = new SupabaseAuthorization();
const dbInstance = new KnexDatabase(knex);
const retriever = new KnexVectorStore(new OpenAIEmbeddings(), {
  knex,
  tableName: "summary_embeddings",
}).asRetriever(1);

let callerScheduler: CallerScheduler | undefined;
let port = parseInt(process.env.SERVER_PORT ?? "42069");
let useAuth = process.env.USE_AUTH ? process.env.USE_AUTH === "true" : true;

const authenticator = new KnexAuthenticator(dbInstance);

const apiServer = new MailGPTAPIServer({
  port,
  database: dbInstance,
  retriever,
  mailAdapter,
  authenticator,
  llm: new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxConcurrency: 5,
    temperature: 0.02,
  }),
  middlewareOpts: {
    useAuth,
  },
  authorizer,
  scheduler: callerScheduler,
  onStartServer(server?: MailGPTServer) {
    if (process.env.WITH_SCHEDULER && process.env.WITH_SCHEDULER === "true") {
      callerScheduler = new CallerScheduler({
        url: new URL(`http://localhost:${port}/gpt/process-emails`).toString(),
        useAuth,
        server,
      });
    }
  },
});

apiServer.startServer();
