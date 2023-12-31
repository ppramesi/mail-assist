"use client";

import React, { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import cookies from "js-cookie";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { SessionContext } from "../layout";
import { login, setTokens } from "@/utils/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [snackbar, openSnackbar] = useState<boolean>(false);
  const { setIsLoggedIn } = useContext(SessionContext);
  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { sessionToken, refreshToken } = await login(email, password);
      setTokens(sessionToken, refreshToken);

      setIsLoggedIn(true);
      router.push("/");
    } catch (error) {
      openSnackbar(true);
      cookies.remove("session_token");
      cookies.remove("refresh_token");
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
