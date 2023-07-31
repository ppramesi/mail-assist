import express, { Express } from "express";
import { BaseMailAdapter } from "./adapters/base";
import { Database } from "./databases/base";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MainExecutor, MainExecutorOpts } from "./chains/executors";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ConversationalEmailEvaluator } from "./chains/user_evaluation";
import {
  buildAllowedHostsRoutes,
  buildChatHistoryRoutes,
  buildContextRoutes,
  buildEmailRoutes,
  buildReplyRoutes,
} from "./routes/express";
import { buildAuthMiddleware } from "./middlewares/auth";
import logger from "./logger/bunyan"; // the logger is already imported here
import { isObject } from "lodash";

export interface MailGPTServerOpts {
  mailAdapter: BaseMailAdapter;
  database: Database;
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
  allowedHosts?: string[];
}

export type MiddlewareOpts = {
  useAuth?: boolean;
};

export interface MailGPTAPIServerOpts extends MailGPTServerOpts {
  port?: number;
  onStartServer?: () => void;
  middlewareOpts?: MiddlewareOpts;
}

export abstract class MailGPTServer {
  mailAdapter: BaseMailAdapter;
  database: Database;
  executor: MainExecutor;
  conversator: ConversationalEmailEvaluator;
  retriever: VectorStoreRetriever;
  context?: Record<string, string>;
  constructor(opts: MailGPTServerOpts) {
    this.database = opts.database;
    this.database.connect();
    this.mailAdapter = opts.mailAdapter;
    this.mailAdapter.connect();
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
    const [emails, context] = await Promise.all([
      this.mailAdapter.fetch(),
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
  async startServer(): Promise<void> {}
}

export class MailGPTAPIServer extends MailGPTServer {
  onStartServer?: () => void;
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
    this.onStartServer = opts.onStartServer;
  }

  buildAuthenticationRoutes() {
    this.app.post("/login", async (req, res) => {
      const {
        body: { password, email },
      } = req;
      const authData = await this.database.getUserAuth(email);
      if (!authData) {
        res.status(403).send({ status: "who are you?" });
      }

      const hashed = await bcrypt.hash(password, authData?.salt!);
      const authenticated = await bcrypt.compare(password, hashed);
      if (authenticated) {
        const metakey = await this.database.getUserMetakey(email);
        const sessionKey = jwt.sign(
          {
            email,
          },
          process.env.TOKEN_KEY! + metakey,
          { expiresIn: "10h" },
        );
        await this.database.setUserSessionKey(email, sessionKey);
        res.status(200).send({ session_key: sessionKey });
      } else {
        res.status(403).send({ status: "wrong password" });
      }
    });

    this.app.post("/register", async (req, res) => {
      const accessToken = req.header("x-access-token");

      if (!process.env.TOKEN_KEY) {
        logger.error("Token key not set.");
        res.status(500).send("Token key not set");
      }

      if (!accessToken) {
        logger.warn("Unauthorized access attempt detected.");
        res.status(403).send("Who the fuck are you?");
      }
      try {
        const decoded = jwt.verify(
          accessToken!,
          process.env.TOKEN_KEY!,
        ) as jwt.JwtPayload;
        if (decoded && isObject(decoded)) {
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
          }
        }
        logger.error("JWT Body fucked up: ", JSON.stringify(decoded));
        res.status(403).send("JWT body fcked up.");
      } catch (err) {
        logger.error("Failed to verify token:", err);
        res.status(403).send("Who the fuck are you?");
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
      } catch (error) {
        logger.error("Error while processing emails:", error);
        res.status(500).send(error);
      }
    });

    gptRoutes.post("/evaluate-email", async (req, res) => {
      const { input, email_id: emailId, reply_id: replyId } = req.body;
      try {
        logger.info(`Starting to evaluate email with id: ${emailId}`);
        const newReplyEmail = await this.evaluateEmail(input, emailId, replyId);
        res.status(200).send({ new_reply_email: newReplyEmail });
      } catch (error) {
        logger.error(
          `Error while evaluating email with id: ${emailId}:`,
          error,
        );
        res.status(500).send(error);
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
    this.onStartServer?.();
  }
}
