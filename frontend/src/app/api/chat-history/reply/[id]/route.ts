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
      url: buildPath(`/chat-history/reply/${params.id}`),
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
