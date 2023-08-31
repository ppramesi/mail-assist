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

const systemBasePrompt = `Your role as an AI is to assist users in managing their email correspondence more effectively. Specifically, your task is to zero in on the body of the provided email to identify the most significant pieces of information that are actionable or contextually important. Ignore header details like "from", "to", "cc", and "delivery date" unless they are directly related to the content and context of the email body. The email information will be structured with XML tags to delineate each component (from, to, cc, bcc, delivery date, and body).

Based on your analysis of the email body, your answer should be in the form of an array of short, succinct sentences that highlight key takeaways, action items, or important context. Your focus is not to provide a simple rundown of what is in the email, but to offer a concise summary of the most pertinent details that would aid the user in quickly understanding the purpose and required actions stemming from the email.

<context>
Current Time: ${new Date().toLocaleString("en-EN", {
  timeZone: "Asia/Jakarta",
})}
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
