import { LLMChain, PromptTemplate } from "langchain";
import { LLMChainInput } from "langchain/chains";
import { BaseMemory, BufferMemory, ChatMessageHistory } from "langchain/memory";
import {
  Database,
  RawChatHistory,
  AIMessage,
  HumanMessage,
} from "../databases/base";
import { ChainValues } from "langchain/schema";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { CallbackManagerForChainRun } from "langchain/callbacks";

const systemBasePrompt = `Your role as an AI is to support users when responding to email exchanges. You were tasked with writing a reply given the email's body, and have written a reply for the given email, but the user has an input would like you to change something. You answer should only be the email's text and nothing else.

Context:
{criteria}

Original Email body:
{body}

Original Intention
{intention}`;

export interface ConversationalEmailEvaluatorOpts extends LLMChainInput {
  memory: BaseMemory;
  db: Database;
  emailId: string;
}

export class ConversationalEmailEvaluator extends LLMChain {
  db: Database;
  chatMessages: (AIMessage | HumanMessage)[];
  emailId: string;
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
    this.emailId = opts.emailId;
  }

  async buildPrompt(fetch: boolean = true) {
    if (fetch || !this.conversationId) {
      const { chat_messages: chatMessages, id } =
        await this.db.getEmailChatHistory(this.emailId);
      this.conversationId = id;
      this.chatMessages = chatMessages;
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
      inputVariables: ["body", "intention", "criteria", "input"],
    });
    this.promptBuilt = true;
  }

  async _call(
    values: ChainValues & this["llm"]["CallOptions"],
    runManager?: CallbackManagerForChainRun | undefined,
  ): Promise<ChainValues> {
    if (!this.promptBuilt) {
      await this.buildPrompt();
    }
    const { input } = values;
    const humanInput: HumanMessage = { type: "human", text: input };
    this.chatMessages.push(humanInput);
    const result = await super._call(values, runManager);
    const aiInput: AIMessage = { type: "ai", text: result.text };
    this.chatMessages.push(aiInput);
    await Promise.all([
      this.db.appendChatHistory(this.conversationId!, [humanInput, aiInput]),
      this.buildPrompt(false),
    ]);
    return result;
  }
}
