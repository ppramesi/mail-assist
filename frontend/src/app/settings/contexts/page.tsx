"use client";

import ContextList from "@/app/_components/context-list";
import { SessionContext } from "../../layout";
import { useContext } from "react";

export default function SettingsContext() {
  const { isLoggedIn } = useContext(SessionContext);

  return (
    <>
      {isLoggedIn ? (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
          <ContextList></ContextList>
        </main>
      ) : (
        <></>
      )}
    </>
  );
}
