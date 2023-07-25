import express, { Express } from "express";
import { MailAdapter } from "./adapters/base";
import { Database } from "./databases/base";
import { fetchMailService } from "./services/fetch_email";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MainExecutor } from "./chains/executors";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
import { ConversationalEmailEvaluator } from "./chains/user_evaluation";

export interface MailGPTServerOpts {
  mailAdapter: MailAdapter;
  database: Database;
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
  allowedHosts: string[];
}

export interface MailGPTAPIServerOpts extends MailGPTServerOpts {
  port?: number;
}

export abstract class MailGPTServer {
  mailAdapter: MailAdapter;
  database: Database;
  executor: MainExecutor;
  conversator: ConversationalEmailEvaluator;
  retriever: VectorStoreRetriever;
  criteria?: Record<string, string>;
  constructor(opts: MailGPTServerOpts) {
    this.database = opts.database;
    this.mailAdapter = opts.mailAdapter;
    this.conversator = new ConversationalEmailEvaluator({
      llm: opts.llm,
      db: opts.database,
    });
    this.executor = new MainExecutor({
      llm: opts.llm,
      allowedHosts: opts.allowedHosts,
      retriever: opts.retriever,
    });
    this.retriever = opts.retriever;
  }

  abstract startServer(): Promise<void>;

  async getContext() {
    return this.criteria
      ? Promise.resolve(this.criteria)
      : this.database.getContext();
  }

  async evaluateEmail(input: string, emailId: string, replyId: string) {
    const [email, reply, context] = await Promise.all([
      this.database.getEmail(emailId),
      this.database.getPotentialReply(replyId),
      this.getContext(),
    ]);
    const { text: newPotentialEmail } = await this.conversator.call({
      criteria: context,
      body: email?.text ?? "",
      intention: reply.intention,
      input,
    });

    return newPotentialEmail;
  }

  async processEmails() {
    const [emails, criteria] = await Promise.all([
      this.mailAdapter.fetch(),
      this.getContext(),
    ]);
    this.executor.setCriteria(criteria ?? {});
    const processedEmails = await this.executor.processEmails(emails);
    const processedPromises = processedEmails.map((emailOrReply) => {
      switch (emailOrReply.process_status) {
        case "empty": {
          return this.database.updateEmailProcessedData(
            emailOrReply.id,
            "empty",
          );
        }
        case "irrelevant": {
          return this.database.updateEmailProcessedData(
            emailOrReply.id,
            "irrelevant",
          );
        }
        case "summarized": {
          const { id, text, from, date } = emailOrReply;
          return Promise.all([
            this.database.updateEmailProcessedData(
              emailOrReply.id,
              "summarized",
              emailOrReply.summary,
            ),
            this.retriever.addDocuments([
              new Document({
                pageContent: emailOrReply.summary,
                metadata: {
                  id,
                  text,
                  from,
                  date: date?.toLocaleString(),
                },
              }),
            ]),
          ]);
        }
        case "potential_reply": {
          return this.database.insertPotentialReply({
            ...emailOrReply,
          });
          break;
        }
      }
    });
    return Promise.all(processedPromises);
  }
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
    this.app.post("process-emails", async (_, res) => {
      try {
        await this.processEmails();
        res.status(200).send({ status: "ok" });
      } catch (error) {
        res.status(500).send(error);
      }
    });
    this.app.post("fetch-chat-history", async (req, res) => {
      const { replyId } = req.body;
      try {
        const chatHistory = await this.database.getEmailChatHistory(replyId);
        res.status(200).send({ chat_history: chatHistory });
      } catch (error) {
        res.status(500).send(error);
      }
    });
    this.app.post("evaluate-email", async (req, res) => {
      const { input, emailId, replyId } = req.body;
      try {
        const newReplyEmail = await this.evaluateEmail(input, emailId, replyId);
        res.status(200).send({ new_reply_email: newReplyEmail });
      } catch (error) {
        res.status(500).send(error);
      }
    });
    //build route
  }

  async startServer() {
    this.app.listen(this.port);
  }
}
