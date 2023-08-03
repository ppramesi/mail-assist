"use client";

import { useState, useEffect } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { fetchWithSessionToken } from "@/utils/client_fetcher";
import { Email } from "./types/email";
import EmailItem from "./email-item";

export default function EmailList() {
  const [fetchedEmails, setEmails] = useState<Email[]>();
  const [isLoading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    fetchWithSessionToken("/api/emails")
      .then((res) => res.json())
      .then((data) => {
        const { emails } = data;
        setEmails(emails);
        setLoading(false);
      });
  }, []);

  return (
    <Box sx={{ width: "100%" }}>
      {isLoading ? (
        <div>loading</div>
      ) : (
        <Stack spacing={2}>
          {fetchedEmails?.map((email, idx) => <EmailItem key={idx} email={email}></EmailItem>)}
        </Stack>
      )}
    </Box>
  );
}
