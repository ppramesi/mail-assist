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

export async function GET(_: NextApiRequest, { params }: { params: { id: string }}){
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/chat-history/${params.id}`),
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

export async function PUT(request: NextApiRequest, { params }: { params: { id: string }}){
  try {
    const { body } = request;
    const chatHistory: { chat: Message[] } = {
      chat: body.chat_messages
    }
    const axiosRequest = await axios.request({
      url: buildPath(`/chat-history/${params.id}`),
      method: "PUT",
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