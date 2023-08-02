"use client";

import cookies from "js-cookie";
// import { useRouter } from 'next/navigation';
import isNil from "lodash/isNil"
import EmailList from "./_components/email-list";
import { useEffect } from "react";
import { useState } from "react"

export default function Home() {
  const [loggedIn, isLoggedIn] = useState<boolean>(false)
  const sessionKey = cookies.get("session_key")
  // const router = useRouter();

  useEffect(() => {
    if (!isNil(sessionKey)) {
      isLoggedIn(true)
    }
  }, [])

  return (
    <>
      {loggedIn ? 
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
          <EmailList></EmailList>
        </main> : 
        <></>
      }
    </>
  )
}

// import cookies from "js-cookie";
// import { redirect } from 'next/navigation';
// import isNil from "lodash/isNil"
// import EmailList from "./_components/email-list";

// export default function Home() {
//   const sessionKey = cookies.get("session_key")

//   if(isNil(sessionKey)){
//     redirect("/login")
//   }

//   return (
//     <main className="flex min-h-screen flex-col items-center justify-between p-24">
//       <EmailList></EmailList>
//     </main>
//   )
// }
