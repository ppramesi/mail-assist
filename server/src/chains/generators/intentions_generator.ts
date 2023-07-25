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

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to generate possible users intentions for replies, given the context below. Generate an array of sentences describing possible user reply intentions.

Context:
{criteria}`;

const userPrompt = `Email from:
{from}

Email body:
{body}

Delivery date:
{delivery_date}`;

const keyName = "intentions";

const outputSchema = z.object({
  [keyName]: z
    .array(z.string())
    .describe("Possible user intentions, as short sentences."),
});

const buildPrompt = () =>
  new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
      HumanMessagePromptTemplate.fromTemplate(userPrompt),
    ],
    inputVariables: ["from", "body", "delivery_date", "criteria"],
  });

export type IntentionsOpts = {
  llm: ChatOpenAI;
};

export class IntentionsGenerator extends LLMChain<any, ChatOpenAI> {
  criteria?: Record<string, string>;
  outputKey: string = keyName;
  constructor(opts: IntentionsOpts) {
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

  setCriteria(newCriteria: Record<string, string>) {
    this.criteria = newCriteria;
  }

  _call(
    values: ChainValues & this["llm"]["CallOptions"],
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    if (!this.criteria) throw new Error("Criteria not set");
    let criteria: string = Object.entries(this.criteria)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...values, criteria }, runManager);
  }
}
