export function buildPath(path: string){
  if(!process.env.MAIL_GPT_SERVER_URL){
    throw new Error("Set backend mail GPT server url");
  }
  const baseUrl = new URL(process.env.MAIL_GPT_SERVER_URL);
  baseUrl.pathname = path;
  return baseUrl.toString();
}