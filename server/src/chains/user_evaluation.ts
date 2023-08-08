import { LLMChainInput, LLMChain } from "langchain/chains";
// import { BaseMemory } from "langchain/memory";
import { Database } from "../databases/base.js";
import { ChainValues } from "langchain/schema";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { CallbackManagerForChainRun, Callbacks } from "langchain/callbacks";
import _ from "lodash";
import { AIMessage, HumanMessage } from "../schema/index.js";

const systemBasePrompt = `Your role as an AI is to support users when responding to email exchanges. You were tasked with writing a reply given the email's body, and have written a reply for the given email in the past. The user has an input and would like you to change something in the reply. You answer should only be the email's text and nothing else.

Context:
{context}

Original Email body:
{body}

Original Intention
{intention}`;

export interface ConversationalEmailEvaluatorOpts
  extends Omit<LLMChainInput, "prompt"> {
  db: Database;
}

export class ConversationalEmailEvaluator extends LLMChain {
  db: Database;
  replyId?: string;
  promptBuilt = false;

  constructor(opts: ConversationalEmailEvaluatorOpts) {
    const prompt = new ChatPromptTemplate({
      promptMessages: [],
      inputVariables: [],
    });
    super({
      ...opts,
      prompt,
    });

    this.db = opts.db;
  }

  buildPrompt(messages: (AIMessage | HumanMessage)[]) {
    const templates = messages.map((message) => {
      if (message.type === "ai") {
        return AIMessagePromptTemplate.fromTemplate(message.text);
      } else {
        return HumanMessagePromptTemplate.fromTemplate(message.text);
      }
    });

    this.prompt = new ChatPromptTemplate({
      promptMessages: [
        SystemMessagePromptTemplate.fromTemplate(systemBasePrompt),
        ...templates,
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ],
      inputVariables: ["body", "intention", "context", "input"],
    });
  }

  async _call(
    aValues: ChainValues &
      this["llm"]["CallOptions"] & {
        chat_messages: (AIMessage | HumanMessage)[];
      },
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    const { chat_messages: chatMessages, ...values } = aValues;
    this.buildPrompt(chatMessages);
    const result = await super._call(values, runManager);

    return result;
  }

  buildToStream(
    aValues: ChainValues &
      this["llm"]["CallOptions"] & {
        chat_messages: (AIMessage | HumanMessage)[];
      },
    callbacks?: Callbacks,
  ) {
    const { chat_messages: chatMessages, ...values } = aValues;
    this.buildPrompt(chatMessages);
    const chain = this.prompt.pipe<string>(this.llm);
    return async function* () {
      const results = await chain.stream(values, {
        callbacks,
      });
      for await (const result of results) {
        yield result;
      }
    };
  }
}
