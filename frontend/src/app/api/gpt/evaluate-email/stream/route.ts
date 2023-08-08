import { buildPath } from "@/utils/server_path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, email_id, reply_id } = body;
    const headers: HeadersInit = new Headers();
    headers.set("Content-Type", "application/json");
    const sessionToken = request.headers.get("x-session-token");
    if (sessionToken) {
      headers.set("x-session-token", sessionToken);
    }
    const fetchResponse = await fetch(
      buildPath("/gpt/evaluate-email/stream/"),
      {
        method: "POST",
        headers,
        body: JSON.stringify({ input, email_id, reply_id }),
      },
    );
    const reader = fetchResponse.body?.getReader();

    return new NextResponse(new ReadableStream(reader), {
      status: fetchResponse.status,
      headers: fetchResponse.headers,
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
