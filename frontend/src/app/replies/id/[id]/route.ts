import { createToken } from "@/utils/auth";
import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function GET(_: NextApiRequest, { params }: { params: { id: string }}){
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/replies/${params.id}`),
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

export async function POST(request: NextApiRequest, { params }: { params: { id: string }}){
  try {
    const { body } = request
    const data = {
      text: body.text,
    }
    const axiosRequest = await axios.request({
      url: buildPath(`/replies/${params.id}`),
      method: "POST",
      headers: {
        "x-access-token": createToken(data)
      },
      data
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}