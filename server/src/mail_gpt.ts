import express, { Express } from "express";
import { BaseMailAdapter } from "./adapters/base.js";
import { Database } from "./databases/base.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MainExecutor, MainExecutorOpts } from "./chains/executors.js";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
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
import { buildSettingsRoutes } from "./routes/express/settings.js";
import { Authenticator } from "./authentication/base.js";
import { SupabaseKnexVectorStore } from "./vectorstores/knex.js";
import { RedactableLangChainTracer } from "./callbacks/redactable_langsmith.js";

export interface MailGPTServerOpts {
  onStartServer?: (instance?: MailGPTServer) => void;
  mailAdapter: BaseMailAdapter;
  database: Database;
  authenticator: Authenticator;
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
  authenticator: Authenticator;
  authorizer?: Authorization;
  context?: Record<string, string>;
  scheduler?: CallerScheduler;
  constructor(opts: MailGPTServerOpts) {
    this.scheduler = opts.scheduler;
    this.database = opts.database;
    this.mailAdapter = opts.mailAdapter;
    this.authorizer = opts.authorizer;
    // this.mailAdapter.connect();
    const redactorTracer = new RedactableLangChainTracer({
      chain: [{ type: "prompt_template_redact", target: "body" }],
    });
    this.conversator = new ConversationalEmailEvaluator({
      llm: opts.llm,
      db: opts.database,
      callbacks: [redactorTracer],
    });
    const executorOpts: MainExecutorOpts = {
      llm: opts.llm,
      retriever: opts.retriever,
      callbacks: [redactorTracer],
    };
    this.executor = new MainExecutor(executorOpts);
    this.retriever = opts.retriever;
    this.allowedHosts = opts.allowedHosts || [];
    this.onStartServer = opts.onStartServer;
    this.authenticator = opts.authenticator;
  }

  abstract startServer(): Promise<void>;

  async getAllowedHostsFilter(userId?: string, hostsParam: AllowedHost[] = []) {
    const hosts = await this.database.getAllowedHosts(userId);
    if (hosts || hostsParam) {
      return buildFilterFunction([...(hosts ?? []), ...hostsParam]);
    }
    return null;
  }

  async *streamEvaluateEmail(
    input: string,
    emailId: string,
    replyId: string,
    userId: string,
  ) {
    let [email, reply, context, chatHistory] = await Promise.all([
      this.database.getEmail(emailId),
      this.database.getReplyEmail(replyId),
      this.database.getContext(userId),
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
      await this.database.insertChatHistory(userId, chatHistory);
    }

    const humanInput: HumanMessage = {
      type: "human",
      text: input,
      timestamp: Date.now(),
    };

    const streamFunction = await this.conversator.buildToStream({
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

  async evaluateEmail(
    input: string,
    emailId: string,
    replyId: string,
    userId: string,
  ) {
    let [email, reply, context, chatHistory] = await Promise.all([
      this.database.getEmail(emailId),
      this.database.getReplyEmail(replyId),
      this.database.getContext(userId),
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
      await this.database.insertChatHistory(userId, chatHistory);
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

  async processEmails(userId?: string) {
    const users: string[] = [];
    if (userId) {
      users.push(userId);
    } else {
      const userIds = await this.database
        .getUsers()
        .then((u) => u.map((v) => v.id));
      users.push(...userIds);
    }

    const promises = users.map(async (id) => {
      const imapSettings = await this.database.getUserImapSettings(id);
      if (!imapSettings) {
        throw new Error("User not found");
      }
      const { imap_settings, ...rest } = imapSettings;
      const imapAuth = { ...rest, ...imap_settings };
      logger.info("Starting to process emails");
      const lastEmail = await this.database.getLatestEmail();
      const [emails, context, hostsFilter] = await Promise.all([
        this.mailAdapter.fetch(imapAuth, lastEmail?.date),
        this.database.getContext(id),
        this.getAllowedHostsFilter(id, this.allowedHosts),
      ]);
      const filteredEmails = emails.filter(hostsFilter ?? (() => false));
      const newEmails = await this.database.insertUnseenEmails(filteredEmails);
      this.executor.setContext(context ?? {});
      try {
        const processedEmails = await this.executor.processEmails(
          id,
          newEmails,
        );
        const processedPromises = processedEmails.map(async (emailOrReply) => {
          switch (emailOrReply.process_status) {
            case "empty": {
              try {
                const result = await this.database.updateEmailProcessedData(
                  emailOrReply.id,
                  "empty",
                );
                logger.info(
                  "Empty email: ",
                  emailOrReply.id,
                  emailOrReply.hash,
                );
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
                  new Promise(async (resolve, reject) => {
                    if (
                      this.retriever.vectorStore instanceof
                      SupabaseKnexVectorStore
                    ) {
                      this.retriever.vectorStore.setJWT({
                        user_id: userId,
                      });
                    }
                    this.retriever
                      .addDocuments([
                        new Document({
                          pageContent: emailOrReply.summary,
                          metadata: {
                            id,
                            text,
                            from,
                            date: date?.toLocaleString(),
                            user_id: id,
                          },
                        }),
                      ])
                      .then((doc) => {
                        if (
                          this.retriever.vectorStore instanceof
                          SupabaseKnexVectorStore
                        ) {
                          this.retriever.vectorStore.unsetJWT();
                        }
                        resolve(doc);
                      })
                      .catch(reject);
                  }),
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
                const result = await this.database.insertReplyEmail(id, {
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
    });

    await Promise.all(promises);
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
    this.app.post("/refresh", async (req, res) => {
      const {
        body: { session_token: sessionToken, refresh_token: refreshToken },
      } = req;
      if (!sessionToken || !refreshToken) {
        logger.error("bad auth: empty tokens");
        res.status(403).send({ status: "empty tokens" });
        return;
      }

      const jwtSigned = await this.authenticator.refreshToken(
        sessionToken,
        refreshToken,
      );
      if (jwtSigned.status === "ok") {
        logger.error(
          `Token refreshed: ${JSON.stringify({
            session_token: sessionToken,
            refresh_token: refreshToken,
          })}`,
        );
        res.status(200).send({ status: "ok", ...jwtSigned.tokens });
        return;
      } else {
        logger.error("bad auth: refresh failed");
        res.status(403).send({ status: "bad auth: refresh failed" });
        return;
      }
    });
    this.app.post("/login", async (req, res) => {
      const { body } = req;
      const { password, email } = body;
      if (_.isNil(password) || _.isNil(email)) {
        logger.error("bad auth: bad request?");
        res.status(403).send({ status: "bad request?" });
        return;
      }
      const authData = await this.database.getUserAuth(email);
      if (!authData) {
        logger.error("bad auth: who are you?");
        res.status(403).send({ status: "who are you?" });
        return;
      }
      const auth = await this.authenticator.login(email, password);

      if (auth.status === "ok") {
        logger.info(`Logging in user ${email}`);
        res.status(200).send({
          status: "ok",
          session_token: auth.tokens.session_token,
          refresh_token: auth.tokens.refresh_token,
        });
        return;
      } else {
        logger.error("bad auth: wrong password or some shit");
        res
          .status(403)
          .send({ status: "bad auth: wrong password or some shit" });
        return;
      }
    });

    this.app.post("/register", async (req, res) => {
      const registrationToken = req.header("x-registration-token");
      if (!registrationToken) {
        logger.warn("Unauthorized access attempt detected.");
        res.status(403).send("Who the fuck are you?");
        return;
      }
      try {
        const { password, email } = req.body;
        if (process.env.REGISTRATION_KEY) {
          const decoded = jwt.verify(
            registrationToken!,
            process.env.REGISTRATION_KEY,
          ) as jwt.JwtPayload;
          if (decoded && _.isObject(decoded)) {
            const { email: JwtEmail } = decoded;
            if (email !== JwtEmail) {
              logger.error(
                "bad email: email mismatch: ",
                JSON.stringify(decoded),
              );
              res.status(403).send({ status: "bad email: email mismatch" });
              return;
            }
          } else {
            logger.error("JWT Body fucked up: ", JSON.stringify(decoded));
            res.status(403).send("JWT body fcked up.");
            return;
          }
        }

        if (password && email) {
          const auth = await this.authenticator.register(email, password);
          if (auth.status === "ok") {
            logger.info(`Registering user ${email}`);
            res.status(200).send({
              status: "ok",
              session_token: auth.tokens.session_token,
              refresh_token: auth.tokens.refresh_token,
            });
            return;
          } else {
            logger.error("bad auth: wrong password or some shit");
            res
              .status(403)
              .send({ status: "bad auth: wrong password or some shit" });
            return;
          }
        }

        logger.error("no auth");
        res.status(403).send("No auth");
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
      this.app.use(buildAuthMiddleware(this.authenticator));
    }
  }

  buildRoute() {
    const gptRoutes = express.Router();

    gptRoutes.get("/process-emails", async (req, res) => {
      try {
        logger.info("Starting to process emails...");
        const {
          body: { user_id: userId, fromAccessToken },
        } = req;
        if (userId) {
          await this.processEmails(userId);
        } else if (fromAccessToken) {
          await this.processEmails();
        } else {
          logger.error("Error while processing emails: auth fail");
          res.status(500).send({ error: "Auth fail" });
          return;
        }
        res.status(200).send({ status: "ok" });
        return;
      } catch (error) {
        logger.error("Error while processing emails:", error);
        res.status(500).send(error);
        return;
      }
    });

    gptRoutes.post("/evaluate-email/stream", async (req, res) => {
      const { body, params } = req;
      const {
        input,
        email_id: emailId,
        reply_id: replyId,
        user_id: userId,
      } = body;
      if (this.authorizer) {
        const policies = await this.authorizer.getEvaluateEmailPolicies(
          userId,
          {
            body,
            params,
            fromAccessToken: body.fromAccessToken,
          },
        );
        if (!policies.updateAllowed) {
          logger.error(`Error while evaluating email with id: no authority`);
          res.status(500).send({ error: "no authority" });
          return;
        }
      }
      try {
        logger.info(`Starting to stream evaluate email with id: ${emailId}`);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain");
        const evaluatorStream = this.streamEvaluateEmail(
          input,
          emailId,
          replyId,
          userId,
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

    gptRoutes.post("/evaluate-email", async (req, res) => {
      const { body, params } = req;
      const {
        input,
        email_id: emailId,
        reply_id: replyId,
        user_id: userId,
      } = body;
      if (this.authorizer) {
        const policies = await this.authorizer.getEvaluateEmailPolicies(
          userId,
          {
            body,
            params,
            fromAccessToken: body.fromAccessToken,
          },
        );
        if (!policies.updateAllowed) {
          logger.error(`Error while evaluating email with id: no authority`);
          res.status(500).send({ error: "no authority" });
          return;
        }
      }
      try {
        logger.info(`Starting to evaluate email with id: ${emailId}`);
        const newReplyEmail = await this.evaluateEmail(
          input,
          emailId,
          replyId,
          userId,
        );
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
    this.app.use(
      "/allowed-hosts",
      buildAllowedHostsRoutes(this.database, this.authorizer),
    );
    this.app.use(
      "/chat-history",
      buildChatHistoryRoutes(this.database, this.authorizer),
    );
    this.app.use(
      "/contexts",
      buildContextRoutes(this.database, this.authorizer),
    );
    this.app.use("/emails", buildEmailRoutes(this.database, this.authorizer));
    this.app.use("/replies", buildReplyRoutes(this.database, this.authorizer));
    this.app.use("/settings", buildSettingsRoutes(this.database));
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
