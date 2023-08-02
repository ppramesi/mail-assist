"use client";

import cookies from "js-cookie";
import { useRouter } from 'next/navigation';
import isNil from "lodash/isNil"
import EmailList from "./_components/email-list";

export default function Home() {
  const sessionKey = cookies.get("session_key")
  const router = useRouter();

  if(isNil(sessionKey)){
    router.push("/login")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <EmailList></EmailList>
    </main>
  )
}
