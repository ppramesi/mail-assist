"use client";

import { ReplyEmail } from "./types/reply";
import { Button, Card, CardContent, Typography } from "@mui/material";
import { useState } from "react";
import { ChatHistory } from "./types/chat-history";
import ChatBox from "./chat-box";
import { isNil } from "lodash";
import { fetchWithSessionToken } from "@/utils/client_fetcher";

export default function ReplyItem({ reply }: { reply: ReplyEmail }) {
  const [chatHistory, setChatHistory] = useState<ChatHistory>();
  const [showChat, setShowChat] = useState<boolean>(false);
  const [requestOnce, setRequestOnce] = useState<boolean>(false);

  const handleShowChat = () => {
    if (!requestOnce) {
      fetchWithSessionToken(`/api/chat-history/email/${reply.email_id}`)
        .then((res) => res.json())
        .then((data) => {
          const { chat_history: myChatHistory } = data;
          if (myChatHistory) {
            setChatHistory(myChatHistory);
          } else {
            const emptyChatHistory: ChatHistory = {
              id: "",
              email_id: reply.email_id,
              reply_id: reply.id,
              chat_messages: [
                {
                  timestamp: Date.now(),
                  type: "ai",
                  text: reply.reply_text,
                },
              ],
            };
            setChatHistory(emptyChatHistory);
          }
          setShowChat(true);
        });
      setRequestOnce(true);
    } else {
      setShowChat(true);
    }
  };

  const handleHideChat = () => {
    setShowChat(false);
  };

  return (
    <Card className="mb-4 p-2 bg-gray-100 rounded-md shadow">
      <CardContent>
        <Typography className="mt-4" color="text.secondary">
          Summary:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {reply.summary}
        </Typography>
        <Typography className="mt-4" color="text.secondary">
          Intention:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {reply.intention}
        </Typography>
        <Typography className="mt-4" color="text.secondary">
          Reply Text:
        </Typography>
        <Typography className="pl-2 whitespace-pre-line" variant="body2">
          {reply.reply_text}
        </Typography>
        {showChat ? (
          <Button onClick={handleHideChat}>Hide Chat</Button>
        ) : (
          <Button onClick={handleShowChat}>Show Chat</Button>
        )}
      </CardContent>
      {!isNil(chatHistory) && showChat ? (
        <ChatBox chatHistory={chatHistory}></ChatBox>
      ) : (
        <></>
      )}
    </Card>
  );
}
