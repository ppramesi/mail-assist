import { CallbackManagerForChainRun } from "langchain/callbacks";
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { ChainValues } from "langchain/schema";
import { stringJoinArrayOrNone } from "../../utils/string.js";

export interface ReplyGeneratorOpts {
  llm: ChatOpenAI;
}

const systemBasePrompt = `Your role as an AI is to support users when responding to email exchanges. Your task is to write a reply given the email's body, user's intention and relevant summaries of previous emails (ignore them if they're irrelevant). Included is the information regarding the email (from, to, cc, bcc addresses, delivery date and body) each delimited with XML tags. You answer should only be the email's text and nothing else. Write the email as if you're going to reply immediately. If the context contains preferred language, write the email in that language. If not, default to english.

<context>
Current Time: ${new Date().toLocaleString("en-EN", {
  timeZone: "Asia/Jakarta",
})}
{context}
</context>

<summaries>
{summaries}
</summaries>`;

const userPrompt = `<email-from>
{from}
</email-from>

<email-to>
{to}
</email-to>

<email-cc>
{cc}
</email-cc>

<email-bcc>
{bcc}
</email-bcc>

<email-body>
{body}
</email-body>

<delivery-date>
{delivery_date}
</delivery-date>

<intention>
{intention}
</intention>`;

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

  constructor(opts: ReplyGeneratorOpts) {
    super({ llm: opts.llm, prompt: buildPrompt() });
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
    this.context["Current Time"] = new Date().toLocaleString("en-EN", {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...rest, context, cc, bcc }, runManager);
  }
}
