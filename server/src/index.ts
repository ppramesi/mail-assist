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
dotenv.config();

if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
  throw new Error(
    "Set the .env file with GMAIL_USER and GMAIL_PASSWORD you dumb fuck!",
  );
}

const mailAdapter = new IMAPGmailAdapter({
  user: process.env.GMAIL_USER!,
  password: process.env.GMAIL_PASSWORD!,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false,
  },
});

const knex = Knex.knex({
  client: "postgresql",
  connection: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT!),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  },
});

const authorizer = new KnexAuthorization(knex);
const dbInstance = new KnexDatabase(knex);
const retriever = new KnexVectorStore(new OpenAIEmbeddings(), {
  knex,
  tableName: "summary_embeddings",
}).asRetriever(3);

let callerScheduler: CallerScheduler | undefined;
let port = parseInt(process.env.SERVER_PORT ?? "42069");
let useAuth = process.env.USE_AUTH ? process.env.USE_AUTH === "true" : true;

const authenticator = new KnexAuthenticator(dbInstance)

const apiServer = new MailGPTAPIServer({
  port,
  database: dbInstance,
  retriever,
  mailAdapter,
  authenticator,
  llm: new ChatOpenAI({
    modelName: "gpt-4",
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
