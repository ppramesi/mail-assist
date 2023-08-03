import express, { Express } from "express";
import { BaseMailAdapter } from "./adapters/base.js";
import { AllowedHost, Database } from "./databases/base.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MainExecutor, MainExecutorOpts } from "./chains/executors.js";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ConversationalEmailEvaluator } from "./chains/user_evaluation.js";
import {
  buildAllowedHostsRoutes,
  buildChatHistoryRoutes,
  buildContextRoutes,
  buildEmailRoutes,
  buildReplyRoutes,
} from "./routes/express/index.js";
import { buildAuthMiddleware } from "./middlewares/auth.js";
import logger from "./logger/bunyan.js"; // the logger is already imported here
import _ from "lodash";
import { CallerScheduler } from "./scheduler/caller.js";

export interface MailGPTServerOpts {
  onStartServer?: (instance?: MailGPTServer) => void;
  mailAdapter: BaseMailAdapter;
  database: Database;
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
  allowedHosts?: AllowedHost[];
  scheduler?: CallerScheduler;
}

export type MiddlewareOpts = {
  useAuth?: boolean;
};

export interface MailGPTAPIServerOpts extends MailGPTServerOpts {
  port?: number;
  middlewareOpts?: MiddlewareOpts;
}

export abstract class MailGPTServer {
  onStartServer?: (instance?: MailGPTServer) => void;
  mailAdapter: BaseMailAdapter;
  database: Database;
  executor: MainExecutor;
  conversator: ConversationalEmailEvaluator;
  retriever: VectorStoreRetriever;
  context?: Record<string, string>;
  scheduler?: CallerScheduler;
  constructor(opts: MailGPTServerOpts) {
    this.scheduler = opts.scheduler;
    this.database = opts.database;
    this.database.connect();
    this.mailAdapter = opts.mailAdapter;
    // this.mailAdapter.connect();
    this.conversator = new ConversationalEmailEvaluator({
      llm: opts.llm,
      db: opts.database,
    });
    const executorOpts: MainExecutorOpts = {
      llm: opts.llm,
      retriever: opts.retriever,
    };
    if (opts.allowedHosts) {
      executorOpts.allowedHosts = opts.allowedHosts;
      this.executor = new MainExecutor(executorOpts);
    } else {
      this.executor = new MainExecutor(executorOpts);
      this.setAllowedHosts();
    }
    this.retriever = opts.retriever;
    this.onStartServer = opts.onStartServer;
  }

  abstract startServer(): Promise<void>;

  async setAllowedHosts() {
    const hosts = await this.database.getAllowedHosts();
    if (hosts) {
      this.executor.setAllowedHosts(hosts);
    }
  }

  async getContext(fromDb = false) {
    return this.context && !fromDb
      ? Promise.resolve(this.context)
      : this.database.getContext();
  }

  async evaluateEmail(input: string, emailId: string, replyId: string) {
    const [email, reply, context] = await Promise.all([
      this.database.getEmail(emailId),
      this.database.getPotentialReply(replyId),
      this.getContext(),
    ]);
    if (!email || !reply) {
      throw new Error("Email or reply not found!");
    }
    const { text: newPotentialEmail } = await this.conversator.call({
      context,
      body: email.text,
      intention: reply.intention,
      input,
    });

    return newPotentialEmail;
  }

  async processEmails() {
    logger.info("Starting to process emails");
    const lastEmail = await this.database.getLatestEmail();
    const [emails, context] = await Promise.all([
      this.mailAdapter.fetch(lastEmail?.date),
      this.getContext(),
    ]);
    await this.database.insertEmails(emails);
    this.executor.setContext(context ?? {});
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
  async startServer(): Promise<void> {
    this.onStartServer?.(this);
  }
}

export class MailGPTAPIServer extends MailGPTServer {
  port: number;
  app: Express;
  constructor(opts: MailGPTAPIServerOpts) {
    super(opts);
    this.app = express();
    this.app.use(express.json());
    this.port = opts.port ?? 8080;
    this.buildAuthenticationRoutes();
    this.buildMiddlewares(opts.middlewareOpts ?? {});
    this.buildRoute();
  }

  buildAuthenticationRoutes() {
    this.app.post("/login", async (req, res) => {
      const { body } = req;
      const { password, email } = body;
      if (_.isNil(password) || _.isNil(email)) {
        res.status(403).send({ status: "bad request?" });
        return;
      }
      const authData = await this.database.getUserAuth(email);
      if (!authData) {
        res.status(403).send({ status: "who are you?" });
        return;
      }

      const hashed = await bcrypt.hash(password, authData?.salt!);
      const authenticated = await bcrypt.compare(password, hashed);
      if (authenticated) {
        const metakey = await this.database.getUserMetakey(email);
        logger.info({
          type: "login",
          email,
          token: process.env.TOKEN_KEY!,
          metakey,
        });
        const sessionKey = jwt.sign(
          {
            email,
          },
          process.env.TOKEN_KEY! + metakey,
          { expiresIn: "10h" },
        );
        await this.database.setUserSessionKey(email, sessionKey);
        res.status(200).send({ session_key: sessionKey });
        return;
      } else {
        res.status(403).send({ status: "wrong password" });
        return;
      }
    });

    this.app.post("/register", async (req, res) => {
      const accessToken = req.header("x-access-token");

      if (!process.env.TOKEN_KEY) {
        logger.error("Token key not set.");
        res.status(500).send("Token key not set");
        return;
      }

      if (!accessToken) {
        logger.warn("Unauthorized access attempt detected.");
        res.status(403).send("Who the fuck are you?");
        return;
      }
      try {
        const decoded = jwt.verify(
          accessToken!,
          process.env.TOKEN_KEY!,
        ) as jwt.JwtPayload;
        if (decoded && _.isObject(decoded)) {
          ["password", "email"].forEach((key) => {
            req.body[key] = decoded[key];
          });
          logger.info(
            `Token successfully verified for user with details: ${JSON.stringify(
              decoded,
            )}`,
          );

          const {
            body: { password, email },
          } = req;

          if (password && email) {
            await this.database.insertUser(email, password);
            res.status(200).send({ status: "ok" });
            return;
          }
        }
        logger.error("JWT Body fucked up: ", JSON.stringify(decoded));
        res.status(403).send("JWT body fcked up.");
        return;
      } catch (err) {
        logger.error("Failed to verify token:", err);
        res.status(403).send("Who the fuck are you?");
        return;
      }
    });
  }

  buildMiddlewares(middlewareOpts: MiddlewareOpts) {
    if (middlewareOpts.useAuth) {
      this.app.use(buildAuthMiddleware(this.database));
    }
  }

  buildRoute() {
    const gptRoutes = express.Router();
    gptRoutes.get("/process-emails", async (_, res) => {
      try {
        logger.info("Starting to process emails...");
        await this.processEmails();
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error("Error while processing emails:", error);
        res.status(500).send(error);
        return;
      }
    });

    gptRoutes.post("/evaluate-email", async (req, res) => {
      const { input, email_id: emailId, reply_id: replyId } = req.body;
      try {
        logger.info(`Starting to evaluate email with id: ${emailId}`);
        const newReplyEmail = await this.evaluateEmail(input, emailId, replyId);
        res.status(200).send({ new_reply_email: newReplyEmail });
        return;
      } catch (error) {
        logger.error(
          `Error while evaluating email with id: ${emailId}:`,
          error,
        );
        res.status(500).send(error);
        return;
      }
    });

    this.app.use("/gpt", gptRoutes);
    this.app.use("/allowed-hosts", buildAllowedHostsRoutes(this.database));
    this.app.use("/chat-history", buildChatHistoryRoutes(this.database));
    this.app.use("/contexts", buildContextRoutes(this.database));
    this.app.use("/emails", buildEmailRoutes(this.database));
    this.app.use("/replies", buildReplyRoutes(this.database));
  }

  async startServer() {
    await new Promise<void>((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`Server started on port ${this.port}`);
        resolve();
      });
    });
    this.onStartServer?.(this);
  }
}
