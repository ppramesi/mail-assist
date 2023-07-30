import { createToken } from "@/utils/auth";
import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function POST(request: NextApiRequest){
  try {
    const { body } = request;
    const { input, email_id, reply_id } = body 
    const axiosRequest = await axios.request({
      url: buildPath("/gpt/evaluate-email/"),
      method: "POST",
      headers: {
        "x-access-token": createToken({ input, email_id, reply_id })
      },
      data: { input, email_id, reply_id }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}