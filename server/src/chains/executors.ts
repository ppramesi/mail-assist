import { BaseChain } from "langchain/chains";
import { buildFilterFunction } from "./filters/simple_host";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { EmailRelevancyEvaluator } from "./evaluators/relevancy";
import { IntentionsGenerator } from "./generators/intentions_generator";
import { KeywordsGenerator } from "./generators/keywords_generator";
import { ReplyGenerator } from "./generators/replier";
import { EmailSummarizer } from "./generators/summarizer";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { CallbackManagerForChainRun, Callbacks } from "langchain/callbacks";
import { ChainValues } from "langchain/schema";
import { Email } from "../adapters/base";
import { Document } from "langchain/document";
import { Database } from "../databases/base";
import * as uuid from "uuid";

export type MainExecutorOpts = {
  allowedHosts: string[];
  llm: ChatOpenAI;
  initialCriteria: Record<string, string>;
  retriever: VectorStoreRetriever;
  db: Database;
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
}

export type ProcessedEmail =
  | EmptyEmail
  | IrrelevantEmail
  | SummarizedEmail
  | PotentialReplyEmail;

export class MainExecutor {
  hostsFilter: (email: Email) => boolean;
  relevancyChain: EmailRelevancyEvaluator;
  intentionsGenerator: IntentionsGenerator;
  keywordsGenerator: KeywordsGenerator;
  replier: ReplyGenerator;
  summarizer: EmailSummarizer;
  retriever: VectorStoreRetriever;
  db: Database;

  constructor(opts: MainExecutorOpts) {
    this.hostsFilter = buildFilterFunction(opts.allowedHosts);
    const chainParams = { criteria: opts.initialCriteria, llm: opts.llm };
    this.relevancyChain = new EmailRelevancyEvaluator(chainParams);
    this.intentionsGenerator = new IntentionsGenerator(chainParams);
    this.keywordsGenerator = new KeywordsGenerator(chainParams);
    this.replier = new ReplyGenerator({
      ...chainParams,
      retriever: opts.retriever,
    });
    this.summarizer = new EmailSummarizer(chainParams);
    this.retriever = opts.retriever;
    this.db = opts.db;
  }

  setCriteria(newCriteria: Record<string, string>) {
    this.relevancyChain.setCriteria(newCriteria);
    this.intentionsGenerator.setCriteria(newCriteria);
    this.keywordsGenerator.setCriteria(newCriteria);
    this.replier.setCriteria(newCriteria);
    this.summarizer.setCriteria(newCriteria);
  }

  async summarizeAndSave(
    id: string,
    values: ChainValues,
    metadata: { [k: string]: any },
    callbacks?: Callbacks,
  ) {
    const { text: summary } = await this.summarizer.call(values, callbacks);
    await Promise.all([
      this.retriever.vectorStore.addDocuments([
        new Document({
          pageContent: summary,
          metadata,
        }),
      ]),
      this.db.updateEmailProcessedData(id, "summarized", summary)
    ])
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

  async processEmails(
    emails: Email[],
    callbacks?: Callbacks,
  ): Promise<ProcessedEmail[]> {
    const processEmailPromise = emails
      .filter(this.hostsFilter)
      .map(async (email) => {
        const { text: body, from, date, id } = email;
        if (body && from && date) {
          let deliveryDate = date.toLocaleString();
          const values = {
            body,
            from: from.text,
            delivery_date: deliveryDate,
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
          const summarizePromise = this.summarizeAndSave(id, values, {
            body,
            from,
            delivery_date: deliveryDate,
          });
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
                intentionsResult.map(async (intention, index) => {
                  const text = await this.generateReply(
                    {
                      ...values,
                      intention,
                      summaries: summariesResult,
                    },
                    callbacks,
                  );
                  const { id: emailId, ...rest } = email;
                  const potentialEmail = {
                    process_status: "potential_reply",
                    intention,
                    reply_text: text,
                    ...rest,
                  } as PotentialReplyEmail;
                  await this.db.insertPotentialReply({
                    ...potentialEmail,
                    email_id: emailId,
                  });
                  return potentialEmail;
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
