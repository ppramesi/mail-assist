import Cookies from "js-cookie";

export function fetchWithSessionToken(url: string, params?: RequestInit) {
  const sessionToken = Cookies.get("session_key");
  let actualParams: RequestInit | undefined;
  if (sessionToken) {
    if (params) {
      actualParams = params;
    } else {
      actualParams = {};
    }
    actualParams.headers = {
      ...actualParams.headers,
      "x-session-token": sessionToken,
    };
  }
  if (
    actualParams?.method &&
    ["post", "put"].includes(actualParams.method.toLowerCase())
  ) {
    actualParams.headers = {
      ...actualParams.headers,
      "Content-Type": "application/json",
    };
  }
  return fetch(url, actualParams);
}
