"use client";

import { SessionContext } from "../../layout";
import { useContext } from "react";
import ImapSettings from "@/app/_components/imap-settings";

export default function SettingsImap() {
  const { isLoggedIn } = useContext(SessionContext);

  return (
    <>
      {isLoggedIn ? (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
          <ImapSettings></ImapSettings>
        </main>
      ) : (
        <></>
      )}
    </>
  );
}
