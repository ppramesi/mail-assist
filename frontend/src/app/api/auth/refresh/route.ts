import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const c = cookies();
  try {
    const body = await request.json();
    const data = {
      session_token: body.session_token,
      refresh_token: body.refresh_token,
    };
    const axiosRequest = await axios.request({
      url: buildPath(`/refresh`),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data,
    });
    const { session_token: newSessionToken, refresh_token: newRefreshToken } =
      axiosRequest.data;
    c.set("session_token", newSessionToken, {
      expires: new Date(new Date().getTime() + 1000 * 60 * 10),
    });
    c.set("refresh_token", newRefreshToken, {
      expires: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7),
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
