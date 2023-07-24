import express, { Express } from "express";
import { MailAdapter } from "./adapters/base";
import { Database } from "./databases/base";
import { fetchMailService } from "./services/fetch_email";

export interface MailGPTServerOpts {
  mailAdapter: MailAdapter;
  database: Database;
}

export interface MailGPTAPIServerOpts extends MailGPTServerOpts {
  port?: number;
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
  constructor(opts: MailGPTAPIServerOpts) {
    super(opts);
    this.app = express();
    this.app.use(express.json());
    this.port = opts.port ?? 8080;
    this.buildRoute();
    this.mailAdapter.connect();
  }

  buildRoute() {
    this.app.post("fetch", fetchMailService(this.mailAdapter, this.database));
    //build route
  }

  async startServer() {
    this.app.listen(this.port);
  }
}
