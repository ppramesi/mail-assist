"use client";

import { useState, useEffect } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { fetchWithSessionToken } from "@/utils/client_fetcher";
import { Email } from "./types/email";
import EmailItem from "./email-item";

export default function EmailList(){
  const [fetchedEmails, setEmails] = useState<Email[]>()
  const [isLoading, setLoading] = useState<boolean>(true)
  useEffect(() => {
    fetchWithSessionToken("/api/emails")
      .then(res => res.json())
      .then(data => {
        const { emails } = data
        setEmails(fetchedEmails)
        setLoading(false)
      })
  }, [])

  return(
    <Box sx={{ width: "100%" }}>
      { isLoading ? <></> : <>
        <Stack spacing={2}>
          {fetchedEmails?.map((email, idx) => {
          return <>
              <EmailItem key={idx} email={email}></EmailItem>
            </>
          })}
        </Stack>
      </> }
    </Box>
  );
}