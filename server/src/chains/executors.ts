import { ChatOpenAI } from "langchain/chat_models/openai";
import { EmailRelevancyEvaluator } from "./evaluators/relevancy.js";
import { IntentionsGenerator } from "./generators/intentions_generator.js";
import { KeywordsGenerator } from "./generators/keywords_generator.js";
import { ReplyGenerator } from "./generators/replier.js";
import { EmailSummarizer } from "./generators/summarizer.js";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Callbacks } from "langchain/callbacks";
import { ChainValues } from "langchain/schema";
import logger from "../logger/bunyan.js";
import {
  Email,
  EmptyEmail,
  IrrelevantEmail,
  ReplyEmail,
  ProcessedEmail,
  SummarizedEmail,
} from "../schema/index.js";
import { SupabaseKnexVectorStore } from "../vectorstores/knex.js";

export type MainExecutorOpts = {
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
  callbacks?: Callbacks;
};

export class MainExecutor {
  relevancyChain: EmailRelevancyEvaluator;
  intentionsGenerator: IntentionsGenerator;
  keywordsGenerator: KeywordsGenerator;
  replier: ReplyGenerator;
  summarizer: EmailSummarizer;
  retriever: VectorStoreRetriever;
  currentUserId?: string;
  context?: Record<string, string>;
  callbacks?: Callbacks;
  // db: Database;

  constructor(opts: MainExecutorOpts) {
    const chainParams = { llm: opts.llm };
    this.callbacks = opts.callbacks;
    this.relevancyChain = new EmailRelevancyEvaluator(chainParams);
    this.intentionsGenerator = new IntentionsGenerator(chainParams);
    this.keywordsGenerator = new KeywordsGenerator(chainParams);
    this.replier = new ReplyGenerator({
      ...chainParams,
    });
    this.summarizer = new EmailSummarizer(chainParams);
    this.retriever = opts.retriever;
    // this.db = opts.db;
  }

  setContext(newContext: Record<string, string>) {
    this.context = newContext;
    this.relevancyChain.setContext(this.context);
    this.intentionsGenerator.setContext(this.context);
    this.keywordsGenerator.setContext(this.context);
    this.replier.setContext(this.context);
    this.summarizer.setContext(this.context);
  }

  private async summarize(values: ChainValues) {
    const { text: summary } = await this.summarizer.call(values, {
      callbacks: this.callbacks,
    });
    return summary;
  }

  private async vectorStoreFetchSummaries(
    values: ChainValues,
    options?: Record<string, any>,
  ) {
    const { extracted_info: extractedInfo } =
      (await this.keywordsGenerator.call(values, {
        callbacks: this.callbacks,
      })) as {
        extracted_info: string[];
      };

    if (this.currentUserId) {
      this.retriever.filter = {
        user_id: {
          equals: this.currentUserId,
        },
      };
    }
    if (
      this.retriever.vectorStore instanceof SupabaseKnexVectorStore &&
      options
    ) {
      this.retriever.vectorStore.setJWT(options.jwt);
    }

    const summaries = await Promise.all(
      extractedInfo.map((keyword) =>
        this.retriever.getRelevantDocuments(keyword, {
          callbacks: this.callbacks,
        }),
      ),
    )
      .then((stuff) => {
        const contents = stuff.flat().map((d) => d.pageContent);
        return Array.from(new Set(contents)).join("\n");
      })
      .finally(() => {
        if (
          this.retriever.vectorStore instanceof SupabaseKnexVectorStore &&
          options
        ) {
          this.retriever.vectorStore.unsetJWT();
        }
      });
    return summaries;
  }

  private async generateIntentions(values: ChainValues) {
    const { intentions } = (await this.intentionsGenerator.call(values, {
      callbacks: this.callbacks,
    })) as { intentions: string[] };
    return intentions;
  }

  private async generateReply(values: ChainValues) {
    const { text } = await this.replier.call(values, {
      callbacks: this.callbacks,
    });
    return text;
  }

  /**
   * When called, returned values hsould be saved to the database and vector database
   * @param emails
   * @param callbacks
   * @returns
   */
  async processEmails(
    userId: string,
    emails: Email[],
  ): Promise<ProcessedEmail[]> {
    this.currentUserId = userId;
    const processEmailPromise = emails.map(async (email) => {
      const { text: body, from, date, to: rawTo, cc, bcc } = email;
      const to = rawTo.slice(0, 10).join("\n");
      if (body && from && date) {
        let deliveryDate = date.toLocaleString();
        const values = {
          body,
          from: from.join("\n"),
          delivery_date: deliveryDate,
          to,
          cc,
          bcc,
        };
        const { decision } = await this.relevancyChain.call(values, {
          callbacks: this.callbacks,
        });
        logger.info(`Decision: ${decision}`);
        if (decision === "none") {
          const irrelevantEmail: IrrelevantEmail = {
            process_status: "irrelevant",
            ...email,
          };
          return Promise.resolve([irrelevantEmail]);
        }
        const summarizePromise = this.summarize(values);
        if (decision === "reply") {
          const fetchSummariesPromise = this.vectorStoreFetchSummaries(values, {
            jwt: {
              user_id: userId,
            },
          });
          const intentionsPromise = this.generateIntentions(values);
          return Promise.all([
            fetchSummariesPromise,
            intentionsPromise,
            summarizePromise,
          ]).then(async ([summariesResult, intentionsResult, summary]) => {
            const generator = await Promise.all(
              intentionsResult.map(async (intention) => {
                const text = await this.generateReply({
                  ...values,
                  intention,
                  summaries: summariesResult,
                });
                const { id: emailId, ...rest } = email;
                return {
                  ...rest,
                  process_status: "reply_email",
                  intention,
                  reply_text: text,
                  email_id: emailId,
                  summary,
                } as ReplyEmail;
              }),
            );
            const summarizedEmail: SummarizedEmail = {
              summary,
              process_status: "summarized",
              ...email,
            };
            return [...generator, summarizedEmail];
          });
        } else {
          return summarizePromise.then((summary) => {
            const summarizedEmail: SummarizedEmail = {
              summary,
              process_status: "summarized",
              ...email,
            };
            return [summarizedEmail];
          });
        }
      } else {
        const emptyEmail: EmptyEmail = { process_status: "empty", ...email };
        return Promise.resolve([emptyEmail]);
      }
    });
    return Promise.all(processEmailPromise).then((k) => k.flat());
  }
}
