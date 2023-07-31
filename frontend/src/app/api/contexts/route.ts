import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function GET(request: NextRequest){
  try {
    const axiosRequest = await axios.request({
      url: buildPath("/contexts/"),
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

export async function POST(request: NextRequest){
  try {
    const body = await request.json();
    const contexts: Record<string, string> = body
    const axiosRequest = await axios.request({
      url: buildPath("/contexts/"),
      method: "POST",
      headers: {
        "x-session-token": request.headers.get("x-session-token")
      },
      data: contexts
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}