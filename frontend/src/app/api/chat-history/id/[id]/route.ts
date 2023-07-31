import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest, { params }: { params: { id: string }}){
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/chat-history/${params.id}`),
      method: "GET",
      headers: {
        "x-session-token": request.headers.get("x-session-token")
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string }}){
  try {
    const body = await request.json();
    const chatHistory: { chat: Message[] } = {
      chat: body.chat_messages
    }
    const axiosRequest = await axios.request({
      url: buildPath(`/chat-history/${params.id}`),
      method: "PUT",
      headers: {
        "x-session-token": request.headers.get("x-session-token")
      },
      data: chatHistory
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

}