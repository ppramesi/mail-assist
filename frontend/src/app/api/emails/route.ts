import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = buildPath("/emails/");
    console.log(url);
    const axiosRequest = await axios.request({
      url: url,
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
