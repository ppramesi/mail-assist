"use client";

import React, { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import cookies from "js-cookie";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { SessionContext } from "../layout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [snackbar, openSnackbar] = useState<boolean>(false);
  const { setIsLoggedIn } = useContext(SessionContext);
  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok === false) {
        throw new Error("Not ok!");
      }
      const { session_token: sessionToken, refresh_token: refreshToken } =
        await res.json();
      if (!sessionToken) {
        throw new Error("Session undefined");
      }
      cookies.set("session_token", sessionToken, {
        expires: new Date(new Date().getTime() + 1000 * 60 * 10),
      });
      cookies.set("refresh_token", refreshToken, {
        expires: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7),
      });
      setIsLoggedIn(true);
      router.push("/");
    } catch (error) {
      openSnackbar(true);
      cookies.remove("session_token");
    }
  };

  const handleClose = () => {
    openSnackbar(false);
  };
  return (
    <>
      <div className="flex items-center justify-center h-screen bg-gray-200">
        <div className="p-12 bg-white rounded shadow-xl w-80">
          <h1 className="text-3xl font-bold mb-10 text-center">Log in</h1>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="email"
                placeholder="Email"
                className="px-3 py-2 w-full border rounded-md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mb-6">
              <input
                type="password"
                placeholder="Password"
                className="px-3 py-2 w-full border rounded-md"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <button
                type="submit"
                className="px-4 py-2 w-full bg-blue-500 text-white rounded-md"
              >
                Log in
              </button>
            </div>
          </form>
        </div>
      </div>
      <Snackbar open={snackbar} onClose={handleClose} autoHideDuration={5000}>
        <Alert severity="error" onClose={handleClose} sx={{ width: "100%" }}>
          Something bad happened!!
        </Alert>
      </Snackbar>
    </>
  );
}
