import cookies from "js-cookie";

export function fetchWithSessionToken(url: string, params?: RequestInit){
  const sessionToken = cookies.get("session_token")
  let actualParams: RequestInit | undefined;
  if(sessionToken){
    if(params){
      actualParams = params
    }else{
      actualParams = {}
    }
    actualParams.headers = {
      ...actualParams.headers,
      "x-session-token": sessionToken
    }
  }
  return fetch(url, actualParams)
}