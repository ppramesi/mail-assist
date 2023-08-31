import { LLMChain } from "langchain/chains";
import { CallbackManagerForChainRun } from "langchain/callbacks";
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

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to analyze the provided email and extract as much important information as possible from the body of the email. Included is the information regarding the email (from, to, cc, bcc addresses, delivery date and body) each delimited with XML tags. Your answer should be in the form of an array of short sentences that contains important information from the email relevant to the following context.

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
