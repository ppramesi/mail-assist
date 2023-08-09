"use client";

import cookies from "js-cookie";
import isNil from "lodash/isNil";
import { useEffect } from "react";
import { useState } from "react";
import ImapSettings from "@/app/_components/imap-settings";

export default function SettingsImap() {
  const [loggedIn, isLoggedIn] = useState<boolean>(false);

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
          <ImapSettings></ImapSettings>
        </main>
      ) : (
        <></>
      )}
    </>
  );
}
