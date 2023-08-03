import schedule, { RecurrenceRule, Job } from "node-schedule";
import fetch from "node-fetch";
import pRetry, { AbortError } from "p-retry";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import logger from "../logger/bunyan.js";
import { MailGPTServer } from "../mail_gpt.js";
dotenv.config();

export type CallerSchedulerOpts = {
  url: string;
  useAuth?: boolean;
  schedule?: string | RecurrenceRule;
  server?: MailGPTServer;
};

export class CallerScheduler {
  paused: boolean;
  job: Job;
  server?: MailGPTServer;
  constructor(opts: CallerSchedulerOpts) {
    this.server = opts.server;
    let procFunction: () => Promise<void>;
    if (this.server) {
      procFunction = async () => {
        if (!this.paused) {
          try {
            await this.server!.processEmails();
            logger.info(`Job ran: Process emails`);
          } catch (error) {
            logger.error(`Process attempt failed: ${error}`);
          }
        }
      };
    } else {
      if (opts.useAuth && !process.env.TOKEN_KEY) {
        throw new Error("Set token key!!");
      }
      procFunction = async () => {
        const fetchFunc = async () => {
          const headers: { [k: string]: string } = {};
          if (opts.useAuth) {
            const token = jwt.sign(
              { exp: Math.floor(Date.now() / 1000) + 10 },
              process.env.TOKEN_KEY!,
            );
            headers["x-access-token"] = token;
          }
          try {
            const response = await fetch.default(opts.url, {
              method: "GET",
              headers,
            });
            logger.info(`Job ran: Process emails`);
            return response.json();
          } catch (error) {
            throw new AbortError(JSON.stringify(error));
          }
        };
        if (!this.paused) {
          await pRetry(fetchFunc, {
            onFailedAttempt: (error) => {
              logger.error(`Process attempt failed: ${error.message}`);
              this.job.cancelNext();
              // throw new Error(error.message);
            },
            retries: 5,
            maxRetryTime: 10 * 1000,
            randomize: true,
          });
        }
      };
    }
    this.paused = false;
    const rule = opts.schedule ?? { rule: "0 9-21/2 * * *" };
    this.job = schedule.scheduleJob(rule, procFunction);
    logger.info(`Job scheduled with rule: ${JSON.stringify(rule)}`);
  }

  pause() {
    this.paused = true;
    logger.info("Scheduler paused");
  }

  unpause() {
    this.paused = false;
    logger.info("Scheduler unpaused");
  }
}
