import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/allowed-hosts/${params.id}`),
      method: "DELETE",
      headers: {
        "x-session-token": request.headers.get("x-session-token"),
      },
    });
    return NextResponse.json(axiosRequest.data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
