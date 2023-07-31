import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function POST(request: NextRequest){
  try {
    const body = await request.json();
    const { input, email_id, reply_id } = body 
    const axiosRequest = await axios.request({
      url: buildPath("/gpt/evaluate-email/"),
      method: "POST",
      headers: {
        "x-session-token": request.headers.get("x-session-token")
      },
      data: { input, email_id, reply_id }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}