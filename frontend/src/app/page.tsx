"use client";

import EmailList from "./_components/email-list";
import { SessionContext } from "./layout";
import { useContext } from "react";

export default function Home() {
  const { isLoggedIn } = useContext(SessionContext);

  return (
    <>
      {isLoggedIn ? (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
          <EmailList></EmailList>
        </main>
      ) : (
        <></>
      )}
    </>
  );
}
