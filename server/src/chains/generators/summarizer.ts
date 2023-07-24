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
  criteria: Record<string, string>;
}

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to summarize the email's body, given the context below. Please make the summary as short as possible.

Context:
{criteria}`;

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
    inputVariables: ["from", "body", "delivery_date", "criteria"],
  });

export class EmailSummarizer extends BaseChain {
  criteria: Record<string, string>;
  stufferChain: StuffDocumentsChain;

  constructor(opts: EmailSummarizerOpts) {
    super(opts);
    const { summarizerOpts } = opts;
    this.stufferChain = loadSummarizationChain(opts.llm, {
      ...summarizerOpts,
      type: "stuff",
      prompt: buildPrompt(),
    }) as StuffDocumentsChain;
    this.criteria = opts.criteria;
  }

  setCriteria(newCriteria: Record<string, string>) {
    this.criteria = newCriteria;
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
    return this.stufferChain.call(
      { ...values, criteria: this.criteria },
      runManager?.getChild(),
    );
  }
}
