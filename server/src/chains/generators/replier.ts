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
import { stringJoinArrayOrNone } from "../utils/string";

export interface ReplyGeneratorOpts {
  llm: ChatOpenAI;
  retriever: VectorStoreRetriever;
}

const systemBasePrompt = `Your role as an AI is to support users when responding to email exchanges. Your task is to write a reply given the email's body, user's intention and relevant summaries of previous emails (ignore them if they're irrelevant). You answer should only be the email's text and nothing else.

Context:
{context}

Past email summaries:
{summaries}`;

const userPrompt = `Email from:
{from}

Email to:
{to}

Email Cc:
{cc}

Email Bcc:
{bcc}

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
      "context",
      "intention",
      "to",
      "cc",
      "bcc",
    ],
  });

export class ReplyGenerator extends LLMChain {
  context?: Record<string, string>;
  retriever: VectorStoreRetriever;

  constructor(opts: ReplyGeneratorOpts) {
    super({ llm: opts.llm, prompt: buildPrompt() });
    this.retriever = opts.retriever;
  }

  setContext(newContext: Record<string, string>) {
    this.context = newContext;
  }

  async _call(
    values: ChainValues &
      this["llm"]["CallOptions"] & {
        newContext?: Record<string, string>;
      },
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    if (!this.context) throw new Error("Context not set");
    let { cc, bcc, ...rest } = values;
    cc = stringJoinArrayOrNone(cc);
    bcc = stringJoinArrayOrNone(bcc);
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...rest, context, cc, bcc }, runManager);
  }
}
