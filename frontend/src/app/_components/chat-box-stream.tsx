"use client";

import {
  AIMessage,
  Message,
  HumanMessage,
  ChatHistory,
} from "./types/chat-history";
import { useState } from "react";
import { TextField } from "@mui/material";
import { Button } from "@mui/material";
import { fetchWithSessionToken } from "@/utils/client_fetcher";

export default function ChatBoxStream({
  chatHistory,
}: {
  chatHistory: ChatHistory;
}) {
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    const humanMessage: HumanMessage = {
      timestamp: Date.now(),
      type: "human",
      text: newMessage,
    };

    setAllMessages([...allMessages, humanMessage]);
    fetchWithSessionToken("/api/gpt/evaluate-email/stream/", {
      method: "POST",
      body: JSON.stringify({
        input: newMessage,
        reply_id: chatHistory.reply_id,
        email_id: chatHistory.email_id,
      }),
    })
      .then((res) => res.body?.getReader())
      .then(async (reader) => {
        const currentAiMessage: AIMessage = {
          timestamp: Date.now(),
          type: "ai",
          text: "",
        };
        const tempAllMessages: Message[] = [...allMessages];
        setAllMessages([...tempAllMessages, currentAiMessage]);
        if (reader) {
          while (true) {
            const { done, value } = await reader?.read();
            if (done) {
              break;
            }
            currentAiMessage.text += value;
            setAllMessages([...tempAllMessages, currentAiMessage]);
          }
        }
        setNewMessage("");
      });
  };

  const handleEnter = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  setAllMessages([...chatHistory.chat_messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-scroll">
        {allMessages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.type === "human" ? "justify-end" : "justify-start"
            } my-2`}
          >
            <div
              className={`py-1 px-2 rounded ${
                message.type === "human" ? "bg-blue-300" : "bg-gray-300"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex"
        >
          <TextField
            className="flex-grow"
            variant="outlined"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleEnter}
            placeholder="Write a message..."
            multiline
            rows={2}
            maxRows={10}
          />
          <Button
            className="ml-2"
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={!newMessage}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
