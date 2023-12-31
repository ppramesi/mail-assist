"use client";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import {
  useEffect,
  useState,
  createContext,
  Dispatch,
  SetStateAction,
} from "react";
import jwt, { JwtPayload } from "jsonwebtoken";
import isNil from "lodash/isNil";
import Link from "next/link";
import "./globals.css";
import { refresh, setTokens } from "@/utils/auth";

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
    const gogogo = () =>
      new Promise(async (resolve, reject) => {
        const sessionToken = Cookies.get("session_token");
        if (isNil(sessionToken)) {
          reject(false);
          return;
        }

        const refToken = Cookies.get("refresh_token");
        if (isNil(refToken)) {
          reject(false);
          return;
        }

        const seshDecoded = jwt.decode(sessionToken) as JwtPayload;
        if (seshDecoded === null) {
          reject(false);
          return;
        }

        if (seshDecoded.exp! < Date.now() / 1000) {
          resolve(true);
          return;
        }

        const refDecoded = jwt.decode(refToken) as JwtPayload;
        if (refDecoded === null) {
          reject(false);
          return;
        }

        if (refDecoded.exp! < Date.now() / 1000) {
          reject(false);
          return;
        }

        const { sessionToken: newSessionToken, refreshToken: newRefreshToken } =
          await refresh(sessionToken, refToken!);

        if (!sessionToken) {
          throw new Error("Session undefined");
        }

        setTokens(newSessionToken, newRefreshToken);

        resolve(true);
        return;
      });
    gogogo()
      .then((res) => {
        if (res) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
          router.push("/login");
        }
      })
      .catch((_err) => {
        setIsLoggedIn(false);
        router.push("/login");
      });
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
