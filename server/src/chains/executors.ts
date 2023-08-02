import { buildFilterFunction } from "./filters/simple_host.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { EmailRelevancyEvaluator } from "./evaluators/relevancy.js";
import { IntentionsGenerator } from "./generators/intentions_generator.js";
import { KeywordsGenerator } from "./generators/keywords_generator.js";
import { ReplyGenerator } from "./generators/replier.js";
import { EmailSummarizer } from "./generators/summarizer.js";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Callbacks } from "langchain/callbacks";
import { ChainValues } from "langchain/schema";
import { Email } from "../adapters/base.js";
import { AllowedHost } from "../databases/base.js";

export type MainExecutorOpts = {
  allowedHosts?: AllowedHost[];
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
};

export interface EmptyEmail extends Email {
  process_status: "empty";
}

export interface IrrelevantEmail extends Email {
  process_status: "irrelevant";
}

export interface SummarizedEmail extends Email {
  process_status: "summarized";
  summary: string;
}

export interface PotentialReplyEmail extends Email {
  process_status: "potential_reply";
  intention: string;
  reply_text: string;
  email_id: string;
  summary: string;
}

export type ProcessedEmail =
  | EmptyEmail
  | IrrelevantEmail
  | SummarizedEmail
  | PotentialReplyEmail;

export class MainExecutor {
  hostsFilter?: (email: Email) => boolean;
  relevancyChain: EmailRelevancyEvaluator;
  intentionsGenerator: IntentionsGenerator;
  keywordsGenerator: KeywordsGenerator;
  replier: ReplyGenerator;
  summarizer: EmailSummarizer;
  retriever: VectorStoreRetriever;
  context?: Record<string, string>;
  // db: Database;

  constructor(opts: MainExecutorOpts) {
    if (opts.allowedHosts) {
      this.hostsFilter = buildFilterFunction(opts.allowedHosts);
    }
    const chainParams = { llm: opts.llm };
    this.relevancyChain = new EmailRelevancyEvaluator(chainParams);
    this.intentionsGenerator = new IntentionsGenerator(chainParams);
    this.keywordsGenerator = new KeywordsGenerator(chainParams);
    this.replier = new ReplyGenerator({
      ...chainParams,
      retriever: opts.retriever,
    });
    this.summarizer = new EmailSummarizer(chainParams);
    this.retriever = opts.retriever;
    // this.db = opts.db;
  }

  setAllowedHosts(allowedHosts: AllowedHost[]) {
    this.hostsFilter = buildFilterFunction(allowedHosts);
  }

  setContext(newContext: Record<string, string>) {
    this.context = newContext;
    this.relevancyChain.setContext(this.context);
    this.intentionsGenerator.setContext(this.context);
    this.keywordsGenerator.setContext(this.context);
    this.replier.setContext(this.context);
    this.summarizer.setContext(this.context);
  }

  async summarizeAndSaveToVectorDB(values: ChainValues, callbacks?: Callbacks) {
    const { text: summary } = await this.summarizer.call(values, callbacks);
    return summary;
  }

  async vectorStoreFetchSummaries(values: ChainValues, callbacks?: Callbacks) {
    const { extracted_info: extractedInfo } =
      (await this.keywordsGenerator.call(values, callbacks)) as {
        extracted_info: string[];
      };
    const summaries = await Promise.all(
      extractedInfo.map((keyword) =>
        this.retriever.getRelevantDocuments(keyword, callbacks),
      ),
    ).then((stuff) => {
      return stuff
        .flat()
        .map((d) => d.pageContent)
        .join("\n");
    });
    return summaries;
  }

  async generateIntentions(values: ChainValues, callbacks?: Callbacks) {
    const { intentions } = (await this.intentionsGenerator.call(
      values,
      callbacks,
    )) as { intentions: string[] };
    return intentions;
  }

  async generateReply(values: ChainValues, callbacks?: Callbacks) {
    const { text } = await this.replier.call(values, callbacks);
    return text;
  }

  /**
   * When called, returned values hsould be saved to the database and vector database
   * @param emails
   * @param callbacks
   * @returns
   */
  async processEmails(
    emails: Email[],
    callbacks?: Callbacks,
  ): Promise<ProcessedEmail[]> {
    const processEmailPromise = emails
      .filter(this.hostsFilter ?? (() => true))
      .map(async (email) => {
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
          const { is_relevant: isRelevant } = await this.relevancyChain.call(
            values,
            callbacks,
          );
          if (isRelevant === "none") {
            const irrelevantEmail: IrrelevantEmail = {
              process_status: "irrelevant",
              ...email,
            };
            return Promise.resolve([irrelevantEmail]);
          }
          const summarizePromise = this.summarizeAndSaveToVectorDB(values);
          if (isRelevant === "reply") {
            const fetchSummariesPromise = this.vectorStoreFetchSummaries(
              values,
              callbacks,
            );
            const intentionsPromise = this.generateIntentions(
              values,
              callbacks,
            );
            return Promise.all([
              fetchSummariesPromise,
              intentionsPromise,
              summarizePromise,
            ]).then(async ([summariesResult, intentionsResult, summary]) => {
              const generator = await Promise.all(
                intentionsResult.map(async (intention) => {
                  const text = await this.generateReply(
                    {
                      ...values,
                      intention,
                      summaries: summariesResult,
                    },
                    callbacks,
                  );
                  const { id: emailId, ...rest } = email;
                  return {
                    ...rest,
                    process_status: "potential_reply",
                    intention,
                    reply_text: text,
                    email_id: emailId,
                    summary,
                  } as PotentialReplyEmail;
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
