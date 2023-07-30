import { createToken } from "@/utils/auth";
import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function GET(){
  try {
    const axiosRequest = await axios.request({
      url: buildPath("/emails/"),
      method: "GET",
      headers: {
        "x-access-token": createToken()
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}