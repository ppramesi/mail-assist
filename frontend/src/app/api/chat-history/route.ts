import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

export type RawChatHistory = {
  id?: string;
  email_id: string;
  reply_id: string;
  chat_messages: (AIMessage | HumanMessage)[];
};

export async function GET(request: NextRequest) {
  try {
    const axiosRequest = await axios.request({
      url: buildPath("/chat-history/"),
      method: "GET",
      headers: {
        "x-session-token": request.headers.get("x-session-token"),
      },
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chatHistory: RawChatHistory = {
      email_id: body.email_id,
      reply_id: body.reply_id,
      chat_messages: body.chat_messages,
    };
    const axiosRequest = await axios.request({
      url: buildPath("/chat-history/"),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": request.headers.get("x-session-token"),
      },
      data: { chat_history: chatHistory },
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
