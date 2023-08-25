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
import { zodToJsonSchema } from "zod-to-json-schema";
import { JsonKeyOutputFunctionsParser } from "langchain/output_parsers";
import { stringJoinArrayOrNone } from "../../utils/string.js";

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to generate possible users intentions for email replies, given the context below. Included is the information regarding the email (from, to, cc, bcc addresses, delivery date and body) each delimited with XML tags. Generate an array of sentences describing possible user reply intentions.

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

export type IntentionsOpts = {
  llm: ChatOpenAI;
  callbacks?: Callbacks;
};

export class IntentionsGenerator extends LLMChain<any, ChatOpenAI> {
  context?: Record<string, string>;
  outputKey: string = keyName;
  constructor(opts: IntentionsOpts) {
    const functionName = "output_formatter";
    super({
      callbacks: opts.callbacks,
      llm: opts.llm,
      prompt: buildPrompt(),
      outputParser: new JsonKeyOutputFunctionsParser({ attrName: keyName }),
      llmKwargs: {
        functions: [
          {
            name: functionName,
            description: `Output formatter. Should always be used to format your response to the user.`,
            parameters: zodToJsonSchema(outputSchema),
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
    let { cc, bcc, ...rest } = values;
    cc = stringJoinArrayOrNone(cc);
    bcc = stringJoinArrayOrNone(bcc);
    let context: string = Object.entries(this.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return super._call({ ...rest, context, cc, bcc }, runManager);
  }
}
