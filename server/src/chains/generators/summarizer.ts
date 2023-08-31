import { CallbackManagerForChainRun } from "langchain/callbacks";
import {
  // BaseChain,
  ChainInputs,
  LLMChain,
  // StuffDocumentsChain,
  StuffDocumentsChainInput,
} from "langchain/chains";
// import { loadSummarizationChain } from "langchain/chains";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { ChainValues } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { stringJoinArrayOrNone } from "../../utils/string.js";

export interface EmailSummarizerOpts extends ChainInputs {
  llm: ChatOpenAI;
  summarizerOpts?: StuffDocumentsChainInput;
}

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to summarize the email's body, given the context below. Included is the information regarding the email (from, to, cc, bcc addresses, delivery date and body) each delimited with XML tags. Please answer with nothing but the summary and make it as short as possible.

<context>
{context}
</context>

<current_time>
${new Date().toLocaleString("en-EN", { timeZone: "Asia/Jakarta" })}
<current_time>`;

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
</delivery-date>`;

const buildPrompt = () =>
  new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
      HumanMessagePromptTemplate.fromTemplate(userPrompt),
    ],
    inputVariables: [
      "from",
      "body",
      "delivery_date",
      "context",
      "to",
      "cc",
      "bcc",
    ],
  });

export class EmailSummarizer extends LLMChain {
  context?: Record<string, string>;
  // stufferChain: StuffDocumentsChain;

  constructor(opts: EmailSummarizerOpts) {
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
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...rest, context, cc, bcc }, runManager);
  }
}
