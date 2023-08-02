"use client";

import ReplyList from "@/app/_components/reply-list";

export default function EmailReply({ params }: { params: { id: string } }){
  return (
    <ReplyList emailId={params.id}></ReplyList>
  )
}