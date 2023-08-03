import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/replies/${params.id}`),
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const data = {
      text: body.text,
    };
    const axiosRequest = await axios.request({
      url: buildPath(`/replies/${params.id}`),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": request.headers.get("x-session-token"),
      },
      data,
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
