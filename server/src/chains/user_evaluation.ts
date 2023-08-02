import { LLMChainInput, LLMChain } from "langchain/chains";
// import { BaseMemory } from "langchain/memory";
import { Database, AIMessage, HumanMessage } from "../databases/base.js";
import { ChainValues } from "langchain/schema";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { CallbackManagerForChainRun } from "langchain/callbacks";
import _ from "lodash";

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
  chatMessages: (AIMessage | HumanMessage)[];
  replyId?: string;
  conversationId?: string;
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
    this.chatMessages = [];
  }

  async buildPrompt(fetch: boolean = true) {
    if (!this.replyId) {
      throw new Error("Please set the potential reply id!");
    }
    if (fetch || !this.conversationId) {
      const { chat_messages: chatMessages, id } =
        await this.db.getChatHistoryByReply(this.replyId);
      this.conversationId = id;
      this.chatMessages = _.cloneDeep(chatMessages);
    }
    const templates = this.chatMessages.map((message) => {
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
    this.promptBuilt = true;
  }

  async _call(
    aValues: ChainValues & this["llm"]["CallOptions"],
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    const { replyId, ...values } = aValues;
    this.replyId = replyId;
    if (!this.replyId) {
      throw new Error("Please set the potential reply id!");
    }
    await this.buildPrompt(true);
    const { input } = values;
    const humanInput: HumanMessage = { type: "human", text: input };
    this.chatMessages.push(humanInput);
    const result = await super._call(values, runManager);
    const aiInput: AIMessage = { type: "ai", text: result.text };
    this.chatMessages.push(aiInput);
    await this.db.appendChatHistory(this.conversationId!, [
      humanInput,
      aiInput,
    ]);

    return result;
  }
}
