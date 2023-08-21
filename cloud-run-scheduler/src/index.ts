import fetch from "node-fetch";
import pRetry, { AbortError } from "p-retry";
import jwt from "jsonwebtoken";
import bunyan from "bunyan";
import { LoggingBunyan } from "@google-cloud/logging-bunyan";

const loggingBunyan = new LoggingBunyan();

const logger = bunyan.createLogger({
  name: "mail-gpt-scheduler",
  streams: [
    { stream: process.stdout, level: "info" },
    loggingBunyan.stream("info"),
  ],
});

type CloudRunCallerSchedulerOpts = {
  url: string;
  useAuth?: boolean;
};

class CloudRunCallerScheduler {
  paused: boolean;
  job: () => Promise<void>;

  constructor(opts: CloudRunCallerSchedulerOpts) {
    if (opts.useAuth && !process.env.ADMIN_KEY) {
      throw new Error("Set token key!!");
    }
    this.paused = false;
    this.job = async () => {
      const fetchFunc = async () => {
        const headers: { [k: string]: string } = {};
        if (opts.useAuth) {
          const token = jwt.sign(
            { exp: Math.floor(Date.now() / 1000) + 36000 },
            process.env.ADMIN_KEY!,
            {
              expiresIn: "10h",
              algorithm: "HS256",
              header: {
                typ: "JWT",
                alg: "HS256",
              },
            },
          );
          headers["x-admin-token"] = token;
        }
        try {
          const response = await fetch(opts.url, { method: "GET", headers });
          logger.info(`Job ran: Process emails`);
          return response.json();
        } catch (error) {
          throw new AbortError(JSON.stringify(error));
        }
      };
      if (!this.paused) {
        await pRetry(fetchFunc, {
          onFailedAttempt: (error) => {
            logger.error(`Fetch attempt failed: ${error.message}`);
            throw new Error(error.message);
          },
          retries: 5,
          maxRetryTime: 10 * 1000,
          randomize: true,
        });
      }
    };
  }

  async run(): Promise<void> {
    await this.job();
  }
}

const caller = new CloudRunCallerScheduler({
  url: process.env.MAIL_GPT_SERVER_URL!,
  useAuth: process.env.USE_AUTH ? process.env.USE_AUTH === "true" : true,
});

caller
  .run()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
