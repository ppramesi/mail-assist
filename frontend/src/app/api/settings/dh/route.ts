import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = {
      uuid: body.uuid,
    };
    const axiosRequest = await axios.request({
      url: buildPath(`/settings/dh/`),
      method: "POST",
      headers: {
        "x-session-token": request.headers.get("x-session-token"),
      },
      data,
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
