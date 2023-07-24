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

const systemBasePrompt = `Your role as an AI is to support users in managing their email exchanges. Your task is to analyze the provided email and gauge its relevance to the user's ongoing needs. You must decide if a response to this email is needed from the user's standpoint.

Respond with one of the following actions:

'reply': Indicating the user should respond and the email should be retained in the database.
'save': Although the user doesn't need to reply, the email carries enough importance to be stored in the database.
'none': The user doesn't need to reply, and the email shouldn't be stored in the database.

For instances where the email is promotional or spam, your response should consistently be 'none'. However, if the email is pertinent to the context information below, your response should at least be 'save'. But, if the email is of utmost importance that warrants a response from the user's standpoint (for instance, if the email explicitly mentions the user's name or email address, or when the user's feedback is sought), you should respond with 'reply'.

Context:
{criteria}`;

const userPrompt = `Email from:
{from}

Email body:
{body}

Delivery date:
{delivery_date}`;

const keyName = "decision";

const outputSchema = z.object({
  [keyName]: z
    .enum(["reply", "save", "none"])
    .describe(
      "Should the user reply to the email, given the context and the email's message? Should the email be saved for future referece?",
    ),
});

const buildPrompt = () =>
  new ChatPromptTemplate({
    promptMessages: [
      SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
      HumanMessagePromptTemplate.fromTemplate(userPrompt),
    ],
    inputVariables: ["from", "body", "delivery_date", "criteria"],
  });

export type RelevancyOpts = {
  criteria: Record<string, string>;
  llm: ChatOpenAI;
};

export class EmailRelevancyEvaluator extends LLMChain<any, ChatOpenAI> {
  criteria: Record<string, string>;
  outputKey: string = keyName;
  constructor(opts: RelevancyOpts) {
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
    this.criteria = opts.criteria;
  }

  setCriteria(newCriteria: Record<string, string>) {
    this.criteria = newCriteria;
  }

  _call(
    values: ChainValues & this["llm"]["CallOptions"],
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    return super._call({ ...values, criteria: this.criteria }, runManager);
  }
}
