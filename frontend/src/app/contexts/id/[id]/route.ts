import { createToken } from "@/utils/auth";
import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function GET(_: NextApiRequest, { params }: { params: { id: string }}){
  try {
    const axiosRequest = await axios.request({
      url: buildPath(`/contexts/${params.id}`),
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
    const kv = {
      key: body.key,
      value: body.value
    }
    const axiosRequest = await axios.request({
      url: buildPath(`/contexts/${params.id}`),
      method: "POST",
      headers: {
        "x-access-token": createToken(kv)
      },
      data: kv
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}