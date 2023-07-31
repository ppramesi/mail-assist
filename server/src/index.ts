import Knex from "knex";
import { IMAPGmailAdapter } from "./adapters/gmail";
import { KnexDatabase } from "./databases/knex";
import { MailGPTAPIServer } from "./mail_gpt";
import { KnexVectorStore } from "./vectorstores/knex";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { ChatOpenAI } from "langchain/chat_models/openai";
import dotenv from "dotenv";
import { CallerScheduler } from "./scheduler/caller";
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

const knex = Knex({
  client: "pg",
  connection: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT!),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  },
});

const dbInstance = new KnexDatabase(knex);
const retriever = new KnexVectorStore(new OpenAIEmbeddings(), {
  knex,
  tableName: "summary_embeddings",
}).asRetriever(3);

let callerScheduler: CallerScheduler;
let port = parseInt(process.env.SERVER_PORT ?? "42069");
let useAuth = process.env.USE_AUTH ? process.env.USE_AUTH === "true" : true;

const apiServer = new MailGPTAPIServer({
  port,
  database: dbInstance,
  retriever,
  mailAdapter,
  llm: new ChatOpenAI({ modelName: "gpt-4" }),
  middlewareOpts: {
    useAuth,
  },
  onStartServer() {
    if (process.env.WITH_SCHEDULER && process.env.WITH_SCHEDULER === "true") {
      callerScheduler = new CallerScheduler({
        url: new URL(`http://localhost:${port}/gpt/process-emails`).toString(),
        useAuth,
      });
    }
  },
});

apiServer.startServer();
