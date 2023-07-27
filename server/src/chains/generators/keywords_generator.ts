import { LLMChain } from "langchain/chains";
import { CallbackManagerForChainRun, Callbacks } from "langchain/callbacks";
import { ChainValues } from "langchain/schema";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { z } from "zod";
import { JsonKeyOutputFunctionsParser } from "langchain/output_parsers";

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to analyze the provided email and extract as much important information as possible from the body of the email. You should answer with an array of short sentences that contains important information relevant to the following context.

Context:
{context}`;

const userPrompt = `Email from:
{from}

Email body:
{body}

Delivery date:
{delivery_date}`;

const keyName = "extracted_info";

const outputSchema = z.object({
  [keyName]: z
    .array(z.string())
    .describe(
      "Important information extracted from the email, as short sentences.",
    ),
});

const buildPrompt = () =>
  new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
      HumanMessagePromptTemplate.fromTemplate(userPrompt),
    ],
    inputVariables: ["from", "body", "delivery_date", "context"],
  });

export type KeywordsOpts = {
  llm: ChatOpenAI;
};

export class KeywordsGenerator extends LLMChain<any, ChatOpenAI> {
  context?: Record<string, string>;
  outputKey: string = keyName;

  constructor(opts: KeywordsOpts) {
    const functionName = "output_formatter";
    super({
      llm: opts.llm,
      prompt: buildPrompt(),
      outputParser: new JsonKeyOutputFunctionsParser({ attrName: keyName }),
      llmKwargs: {
        functions: [
          {
            name: functionName,
            description: `Output formatter. Should always be used to format your response to the user.`,
            parameters: outputSchema,
          },
        ],
        function_call: {
          name: functionName,
        },
      },
    });
  }

  setContext(newContext: Record<string, string>) {
    this.context = newContext;
  }

  _call(
    values: ChainValues & this["llm"]["CallOptions"],
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    if (!this.context) throw new Error("Context not set");
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...values, context }, runManager);
  }
}
