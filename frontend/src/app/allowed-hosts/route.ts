import { createToken } from "@/utils/auth";
import { buildPath } from "@/utils/server_path";
import axios from "axios";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";

export const runtime = 'nodejs'

export async function GET() {
  try {
    const axiosRequest = await axios.request({
      url: buildPath("/allowed-hosts/"),
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

export async function POST(request: NextApiRequest) {
  try {
    const { body } = request;
    const axiosRequest = await axios.request({
      url: buildPath("/allowed-hosts/"),
      method: "POST",
      headers: {
        "x-access-token": createToken({ hosts: body.hosts })
      },
      data: {
        hosts: body.hosts as string[]
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function DELETE(request: NextApiRequest) {
  try {
    const { body } = request;
    const axiosRequest = await axios.request({
      url: buildPath("/allowed-hosts/"),
      method: "DELETE",
      headers: {
        "x-access-token": createToken({ hosts: body.hosts })
      },
      data: {
        hosts: body.hosts as string[]
      }
    })
    return NextResponse.json(axiosRequest.data)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}