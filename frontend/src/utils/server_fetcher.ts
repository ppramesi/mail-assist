import { cookies } from "next/headers";

export function fetchWithSessionToken(url: string, params?: RequestInit){
  const c = cookies();
  const sessionToken = c.get("session_token")
  let actualParams: RequestInit | undefined;
  if(sessionToken){
    if(params){
      actualParams = params
    }else{
      actualParams = {}
    }
    actualParams.headers = {
      ...actualParams.headers,
      "x-session-token": sessionToken.value
    }
  }
  return fetch(url, actualParams)
}