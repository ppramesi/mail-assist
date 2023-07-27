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

export interface EmailSummarizerOpts extends ChainInputs {
  llm: ChatOpenAI;
  summarizerOpts?: StuffDocumentsChainInput;
}

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to summarize the email's body, given the context below. Please make the summary as short as possible.

Context:
{context}`;

const userPrompt = `Email from:
{from}

Email body:
{body}

Delivery date:
{delivery_date}`;

const buildPrompt = () =>
  new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
      HumanMessagePromptTemplate.fromTemplate(userPrompt),
    ],
    inputVariables: ["from", "body", "delivery_date", "context"],
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
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return this.stufferChain.call(
      { ...values, context },
      runManager?.getChild(),
    );
  }
}
