import { CallbackManagerForChainRun } from "langchain/callbacks";
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { ChainValues } from "langchain/schema";
import { VectorStoreRetriever } from "langchain/vectorstores/base";

export interface ReplyGeneratorOpts {
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
}

const systemBasePrompt = `Your role as an AI is to support users when responding to email exchanges. Your task is to write a reply given the email's body, user's intention and relevant summaries of previous emails (ignore them if they're irrelevant). You answer should only be the email's text and nothing else.

Context:
{criteria}

Past email summaries:
{summaries}`;

const userPrompt = `Email from:
{from}

Email body:
{body}

Delivery date:
{delivery_date}

Intention:
{intention}`;

const buildPrompt = () =>
  new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
      HumanMessagePromptTemplate.fromTemplate(userPrompt),
    ],
    inputVariables: [
      "summaries",
      "from",
      "body",
      "delivery_date",
      "criteria",
      "intention",
    ],
  });

export class ReplyGenerator extends LLMChain {
  criteria?: Record<string, string>;
  retriever: VectorStoreRetriever;

  constructor(opts: ReplyGeneratorOpts) {
    super({ llm: opts.llm, prompt: buildPrompt() });
    this.retriever = opts.retriever;
  }

  setCriteria(newCriteria: Record<string, string>) {
    this.criteria = newCriteria;
  }

  async _call(
    values: ChainValues &
      this["llm"]["CallOptions"] & {
        newCriteria?: Record<string, string>;
      },
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    if (!this.criteria) throw new Error("Criteria not set");
    let criteria: string = Object.entries(this.criteria)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...values, criteria }, runManager);
  }
}
