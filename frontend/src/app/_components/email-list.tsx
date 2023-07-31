"use server";

import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { fetchWithSessionToken } from "@/utils/fetcher";
import { Email } from "./types/email";
import EmailItem from "./email-item";

export default async function EmailList(){
  const response = await fetchWithSessionToken("/api/emails")
  const { emails } = (await response.json()) as { emails: Email[] }

  return(
    <Box sx={{ width: "100%" }}>
      <Stack spacing={2}>
        {emails?.map((email) => {
          return <EmailItem key={email.hash} email={email}></EmailItem>
        })}
      </Stack>
    </Box>
  );
}