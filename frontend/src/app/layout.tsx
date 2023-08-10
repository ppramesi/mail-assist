"use client";

import { useRouter } from "next/navigation";
import "./globals.css";
import Cookies from "js-cookie";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  Dispatch,
  SetStateAction,
} from "react";
import isNil from "lodash/isNil";
import Link from "next/link";

export const SessionContext = createContext<{
  isLoggedIn: boolean;
  setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
}>({
  isLoggedIn: false,
  setIsLoggedIn: () => {},
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const sessionKey = Cookies.get("session_key");
    if (isNil(sessionKey)) {
      router.push("/login");
    } else {
      setIsLoggedIn(true);
    }
  }, []);

  return (
    <html lang="en">
      <SessionContext.Provider value={{ isLoggedIn, setIsLoggedIn }}>
        <body>
          {isLoggedIn ? (
            <>
              <nav className="flex flex-row gap-4">
                <Link href="/">Home</Link>
                <Link href="/settings/contexts">Contexts</Link>
                <Link href="/settings/imap">IMAP Settings</Link>
              </nav>
            </>
          ) : (
            <></>
          )}
          {children}
        </body>
      </SessionContext.Provider>
    </html>
  );
}
