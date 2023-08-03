import { cookies } from "next/headers";

export function fetchWithSessionToken(url: string, params?: RequestInit) {
  const c = cookies();
  const sessionToken = c.get("session_key");
  let actualParams: RequestInit | undefined;
  if (sessionToken) {
    if (params) {
      actualParams = params;
    } else {
      actualParams = {};
    }
    actualParams.headers = {
      ...actualParams.headers,
      "x-session-token": sessionToken.value,
    };
  }
  if (actualParams?.method && actualParams.method.toLowerCase() == "post") {
    actualParams.headers = {
      ...actualParams.headers,
      "Content-Type": "application/json",
    };
  }
  return fetch(url, actualParams);
}
