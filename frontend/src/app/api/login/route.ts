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
      password: body.password,
      email: body.email,
    };
    const axiosRequest = await axios.request({
      url: buildPath(`/login`),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data,
    });
    const { session_key: sessionKey } = axiosRequest.data;
    c.set("session_key", sessionKey, {
      expires: new Date(new Date().getTime() + 1000 * 60 * 60 * 10),
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
