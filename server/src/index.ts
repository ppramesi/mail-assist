import Knex from "knex";
import { KnexDatabase } from "./databases/knex.js";
import { MailGPTAPIServer, MailGPTServer } from "./mail_gpt.js";
import { KnexVectorStore } from "./vectorstores/knex.js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import dotenv from "dotenv";
import { CallerScheduler } from "./scheduler/caller.js";
import { IMAPGmailAdapter } from "./adapters/gmail.js";
import { KnexAuthorization } from "./authorization/knex.js";
import { KnexAuthenticator } from "./authentication/knex.js";
import { buildConfig } from "./knex_config.js";

dotenv.config();

console.log("mail-assist starting!");

const mailAdapter = new IMAPGmailAdapter();

const KnexConfig = buildConfig(process.env);

const knex = Knex.knex(
  KnexConfig[process.env.USE_KNEX_CONFIG ?? "development"],
);

const authorizer = new KnexAuthorization(knex);
const dbInstance = new KnexDatabase(knex);
const retriever = new KnexVectorStore(new OpenAIEmbeddings(), {
  knex,
  tableName: "summary_embeddings",
}).asRetriever(3);

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
    modelName: "gpt-3.5",
    maxConcurrency: 5,
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
