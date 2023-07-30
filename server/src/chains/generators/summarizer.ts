import { CallbackManagerForChainRun, Callbacks } from "langchain/callbacks";
import {
  BaseChain,
  ChainInputs,
  StuffDocumentsChain,
  StuffDocumentsChainInput,
} from "langchain/chains";
import { loadSummarizationChain } from "langchain/chains";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { ChainValues } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { stringJoinArrayOrNone } from "../utils/string";

export interface EmailSummarizerOpts extends ChainInputs {
  llm: ChatOpenAI;
  summarizerOpts?: StuffDocumentsChainInput;
}

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to summarize the email's body, given the context below. Included is the information regarding the email (from, to, cc, bcc addresses, delivery date and body) each delimited with XML tags. Please make the summary as short as possible.

<context>
{context}
</context>`;

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

export class EmailSummarizer extends BaseChain {
  context?: Record<string, string>;
  stufferChain: StuffDocumentsChain;

  constructor(opts: EmailSummarizerOpts) {
    super(opts);
    const { summarizerOpts } = opts;
    this.stufferChain = loadSummarizationChain(opts.llm, {
      ...summarizerOpts,
      type: "stuff",
      prompt: buildPrompt(),
    }) as StuffDocumentsChain;
  }

  setContext(newContext: Record<string, string>) {
    this.context = newContext;
  }

  get inputKeys(): string[] {
    return this.stufferChain.outputKeys;
  }

  get outputKeys(): string[] {
    return this.stufferChain.inputKeys;
  }

  _chainType(): string {
    return "summarizer_chain";
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    if (!this.context) throw new Error("Context not set");
    let { cc, bcc, ...rest } = values;
    cc = stringJoinArrayOrNone(cc);
    bcc = stringJoinArrayOrNone(bcc);
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return this.stufferChain.call(
      { ...rest, context, cc, bcc },
      runManager?.getChild(),
    );
  }
}
