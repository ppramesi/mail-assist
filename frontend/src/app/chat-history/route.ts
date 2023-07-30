import { createToken } from "@/utils/auth";
import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";

export const runtime = 'nodejs'

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

export async function GET(){
  try {
    const axiosRequest = await axios.request({
      url: buildPath("/chat-history/"),
      method: "GET",
      headers: {
        "x-access-token": createToken()
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function POST(request: NextApiRequest){
  try {
    const { body } = request;
    const chatHistory: RawChatHistory = {
      email_id: body.email_id,
      reply_id: body.reply_id,
      chat_messages: body.chat_messages
    }
    const axiosRequest = await axios.request({
      url: buildPath("/chat-history/"),
      method: "POST",
      headers: {
        "x-access-token": createToken(chatHistory)
      },
      data: chatHistory
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}