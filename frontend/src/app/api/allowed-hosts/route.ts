import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextResponse, NextRequest } from "next/server";

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const axiosRequest = await axios.request({
      url: buildPath("/allowed-hosts/"),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const axiosRequest = await axios.request({
      url: buildPath("/allowed-hosts/"),
      method: "POST",
      headers: {
        "x-session-token": request.headers.get("x-session-token")
      },
      data: {
        hosts: body.hosts as string[]
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const axiosRequest = await axios.request({
      url: buildPath("/allowed-hosts/"),
      method: "DELETE",
      headers: {
        "x-session-token": request.headers.get("x-session-token")
      },
      data: {
        hosts: body.hosts as string[]
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}