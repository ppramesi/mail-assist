import express, { Express } from "express";
import { MailAdapter } from "./adapters/base";
import { Database } from "./databases/base";
import { fetchMailService } from "./services/fetch_email";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MainExecutor } from "./chains/executors";
import { VectorStoreRetriever } from "langchain/vectorstores/base";

export interface MailGPTServerOpts {
  mailAdapter: MailAdapter;
  database: Database;
}

export interface MailGPTAPIServerOpts extends MailGPTServerOpts {
  port?: number;
  allowedHosts: string[];
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
}

export abstract class MailGPTServer {
  mailAdapter: MailAdapter;
  database: Database;
  constructor(opts: MailGPTServerOpts) {
    this.database = opts.database;
    this.mailAdapter = opts.mailAdapter;
  }

  abstract startServer(): Promise<void>;
}

export class MailGPTGRPCServer extends MailGPTServer {
  async startServer(): Promise<void> {}
}

export class MailGPTAPIServer extends MailGPTServer {
  port: number;
  app: Express;
  executor: MainExecutor;
  constructor(opts: MailGPTAPIServerOpts) {
    super(opts);
    this.executor = new MainExecutor({
      llm: opts.llm,
      allowedHosts: opts.allowedHosts,
      retriever: opts.retriever,
    });
    this.app = express();
    this.app.use(express.json());
    this.port = opts.port ?? 8080;
    this.buildRoute();
    this.mailAdapter.connect();
  }

  buildRoute() {
    this.app.post("fetch", fetchMailService(this.mailAdapter, this.database));
    this.app.post("process-emails", async (req, res) => {});
    //build route
  }

  async startServer() {
    this.app.listen(this.port);
  }
}
