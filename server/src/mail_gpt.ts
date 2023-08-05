import express, { Express } from "express";
import { BaseMailAdapter } from "./adapters/base.js";
import {
  Database,
} from "./databases/base.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MainExecutor, MainExecutorOpts } from "./chains/executors.js";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as uuid from "uuid";
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
import { buildFilterFunction } from "./filters/simple_host.js";
import { AIMessage, AllowedHost, HumanMessage } from "./schema/index.js";
import { Authorization } from "./authorization/base.js";

export interface MailGPTServerOpts {
  onStartServer?: (instance?: MailGPTServer) => void;
  mailAdapter: BaseMailAdapter;
  database: Database;
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
  allowedHosts?: AllowedHost[];
  scheduler?: CallerScheduler;
  authorizer?: Authorization;
}

export type MiddlewareOpts = {
  useAuth?: boolean;
};

export interface MailGPTAPIServerOpts extends MailGPTServerOpts {
  port?: number;
  middlewareOpts?: MiddlewareOpts;
}

export abstract class MailGPTServer {
  allowedHosts: AllowedHost[] = [];
  onStartServer?: (instance?: MailGPTServer) => void;
  mailAdapter: BaseMailAdapter;
  database: Database;
  executor: MainExecutor;
  conversator: ConversationalEmailEvaluator;
  retriever: VectorStoreRetriever;
  authorizer?: Authorization;
  context?: Record<string, string>;
  scheduler?: CallerScheduler;
  constructor(opts: MailGPTServerOpts) {
    this.scheduler = opts.scheduler;
    this.database = opts.database;
    this.database.connect();
    this.mailAdapter = opts.mailAdapter;
    this.authorizer = opts.authorizer;
    // this.mailAdapter.connect();
    this.conversator = new ConversationalEmailEvaluator({
      llm: opts.llm,
      db: opts.database,
    });
    const executorOpts: MainExecutorOpts = {
      llm: opts.llm,
      retriever: opts.retriever,
    };
    this.executor = new MainExecutor(executorOpts);
    this.retriever = opts.retriever;
    this.allowedHosts = opts.allowedHosts || [];
    this.onStartServer = opts.onStartServer;
  }

  abstract startServer(): Promise<void>;

  async getAllowedHostsFilter(hostsParam: AllowedHost[] = []) {
    const hosts = await this.database.getAllowedHosts();
    if (hosts || hostsParam) {
      return buildFilterFunction([...(hosts ?? []), ...hostsParam]);
    }
    return null;
  }

  async getContext(fromDb = false) {
    return this.context && !fromDb
      ? Promise.resolve(this.context)
      : this.database.getContext();
  }

  async *streamEvaluateEmail(input: string, emailId: string, replyId: string) {
    let [email, reply, context, chatHistory] = await Promise.all([
      this.database.getEmail(emailId),
      this.database.getReplyEmail(replyId),
      this.getContext(),
      this.database.getChatHistoryByReply(replyId),
    ]);
    if (!email || !reply) {
      throw new Error("Email, reply or conversation not found!");
    }

    if (!chatHistory) {
      chatHistory = {
        id: uuid.v4(),
        email_id: emailId,
        reply_id: replyId,
        chat_messages: [
          { type: "ai", text: reply.reply_text!, timestamp: Date.now() },
        ],
      };
      await this.database.insertChatHistory(chatHistory);
    }

    const humanInput: HumanMessage = {
      type: "human",
      text: input,
      timestamp: Date.now(),
    };

    const streamFunction = this.conversator.buildToStream({
      context: context
        ? Object.entries(context).map(([key, value]) => `${key}: ${value}`)
        : "",
      chat_messages: chatHistory.chat_messages,
      body: email.text,
      intention: reply.intention,
      input,
    });

    let newPotentialEmail = "";
    for await (const result of streamFunction()) {
      newPotentialEmail += result ?? "";
      yield result;
    }

    const aiInput: AIMessage = {
      type: "ai",
      text: newPotentialEmail,
      timestamp: Date.now() + 1,
    };
    await this.database.appendChatHistory(chatHistory.id, [
      humanInput,
      aiInput,
    ]);
  }

  async evaluateEmail(input: string, emailId: string, replyId: string) {
    let [email, reply, context, chatHistory] = await Promise.all([
      this.database.getEmail(emailId),
      this.database.getReplyEmail(replyId),
      this.getContext(),
      this.database.getChatHistoryByReply(replyId),
    ]);
    if (!email || !reply) {
      throw new Error("Email, reply or conversation not found!");
    }

    if (!chatHistory) {
      chatHistory = {
        id: uuid.v4(),
        email_id: emailId,
        reply_id: replyId,
        chat_messages: [
          { type: "ai", text: reply.reply_text!, timestamp: Date.now() },
        ],
      };
      await this.database.insertChatHistory(chatHistory);
    }

    const humanInput: HumanMessage = {
      type: "human",
      text: input,
      timestamp: Date.now(),
    };

    const { text: newPotentialEmail } = await this.conversator.call({
      context: context
        ? Object.entries(context).map(([key, value]) => `${key}: ${value}`)
        : "",
      chat_messages: chatHistory.chat_messages,
      body: email.text,
      intention: reply.intention,
      input,
    });

    const aiInput: AIMessage = {
      type: "ai",
      text: newPotentialEmail,
      timestamp: Date.now() + 1,
    };
    await this.database.appendChatHistory(chatHistory.id, [
      humanInput,
      aiInput,
    ]);

    return newPotentialEmail;
  }

  async processEmails() {
    logger.info("Starting to process emails");
    const lastEmail = await this.database.getLatestEmail();
    const [emails, context, hostsFilter] = await Promise.all([
      this.mailAdapter.fetch(lastEmail?.date),
      this.getContext(),
      this.getAllowedHostsFilter(this.allowedHosts),
    ]);
    const filteredEmails = emails.filter(hostsFilter ?? (() => false));
    const newEmails = await this.database.insertUnseenEmails(filteredEmails);
    this.executor.setContext(context ?? {});
    try {
      const processedEmails = await this.executor.processEmails(newEmails);
      const processedPromises = processedEmails.map(async (emailOrReply) => {
        switch (emailOrReply.process_status) {
          case "empty": {
            try {
              const result = await this.database.updateEmailProcessedData(
                emailOrReply.id,
                "empty",
              );
              logger.info("Empty email: ", emailOrReply.id, emailOrReply.hash);
              return result;
            } catch (error) {
              logger.error(error);
              return Promise.resolve();
            }
          }
          case "irrelevant": {
            try {
              const result = await this.database.updateEmailProcessedData(
                emailOrReply.id,
                "irrelevant",
              );
              logger.info(
                "Irrelevant email: ",
                emailOrReply.id,
                emailOrReply.hash,
              );
              return result;
            } catch (error) {
              logger.error(error);
              return Promise.resolve();
            }
          }
          case "summarized": {
            try {
              const { id, text, from, date } = emailOrReply;
              const result = await Promise.all([
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
              logger.info(
                "Summarized email: ",
                emailOrReply.id,
                emailOrReply.hash,
              );
              return result;
            } catch (error) {
              logger.error(error);
              return Promise.resolve();
            }
          }
          case "reply_email": {
            try {
              const result = await this.database.insertReplyEmail({
                ...emailOrReply,
              });
              logger.info(
                "Potential reply: ",
                emailOrReply.id,
                emailOrReply.hash,
              );
              return result;
            } catch (error) {
              logger.error(error);
              return Promise.resolve();
            }
          }
        }
      });
      return Promise.all(processedPromises);
    } catch (error) {
      logger.error(error);
      return Promise.resolve();
    }
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
        const userData = await this.database.getUserByEmail(email);
        if(!userData){
          res.status(403).send({ status: "?????" })
          return
        }
        const { id, metakey } = userData
        const sessionKey = jwt.sign(
          {
            email,
            user_id: id
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

    gptRoutes.post("/stream/evaluate-email", async (req, res) => {
      const { input, email_id: emailId, reply_id: replyId } = req.body;
      try {
        logger.info(`Starting to stream evaluate email with id: ${emailId}`);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain");
        const evaluatorStream = this.streamEvaluateEmail(
          input,
          emailId,
          replyId,
        );
        for await (const chunk of evaluatorStream) {
          if (chunk) {
            res.write(chunk);
          }
        }
        res.end();
        return;
      } catch (error) {
        logger.error(
          `Error while stream evaluating email with id: ${emailId}:`,
          error,
        );
        res.status(500).send(error);
        return;
      }
    });

    this.app.use("/gpt", gptRoutes);
    this.app.use("/allowed-hosts", buildAllowedHostsRoutes(this.database, this.authorizer));
    this.app.use("/chat-history", buildChatHistoryRoutes(this.database, this.authorizer));
    this.app.use("/contexts", buildContextRoutes(this.database, this.authorizer));
    this.app.use("/emails", buildEmailRoutes(this.database, this.authorizer));
    this.app.use("/replies", buildReplyRoutes(this.database, this.authorizer));
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
