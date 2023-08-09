import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/settings/`),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = {
      password: body.password,
      host: body.host,
      port: body.port,
      imap_settings: body.imap_settings,
      key_uuid: body.uuid,
      iv: body.iv,
      public_key: body.public_key,
    };
    const axiosRequest = await axios.request({
      url: buildPath(`/settings/`),
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
