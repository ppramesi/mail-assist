"use client";

import ContextList from "@/app/_components/context-list";
import cookies from "js-cookie";
import isNil from "lodash/isNil";
import { useEffect } from "react";
import { useState } from "react";

export default function SettingsContext() {
  const [loggedIn, isLoggedIn] = useState<boolean>(false);
  // const router = useRouter();

  useEffect(() => {
    const sessionKey = cookies.get("session_key");
    if (!isNil(sessionKey)) {
      isLoggedIn(true);
    }
  }, []);

  return (
    <>
      {loggedIn ? (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
          <ContextList></ContextList>
        </main>
      ) : (
        <></>
      )}
    </>
  );
}
