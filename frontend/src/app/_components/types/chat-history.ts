export type Message = {
  type: "ai" | "human";
  text: string;
};

export type AIMessage = Message & {
  type: "ai";
};

export type HumanMessage = Message & {
  type: "human";
};

export type ChatHistory = {
  id: string;
  email_id: string;
  reply_id: string;
  chat_messages: (AIMessage | HumanMessage)[];
};
