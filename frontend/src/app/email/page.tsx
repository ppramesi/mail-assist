"use server";

import { fetchWithSessionToken } from "@/utils/server_fetcher";
import EmailList from "../_components/email-list";

export default async function Email(){
  const response = await fetchWithSessionToken(`/api/emails/`)
  const { emails } = await response.json()
  return <EmailList emails={emails}></EmailList>
}