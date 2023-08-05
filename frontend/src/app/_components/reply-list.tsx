"use client";

import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { fetchWithSessionToken } from "@/utils/client_fetcher";
import ReplyItem from "./reply-item";
import { ReplyEmail } from "./types/reply";
import { useEffect, useState } from "react";
import { Email } from "./types/email";
import { Card, CardContent, Typography } from "@mui/material";

export default function ReplyList({ emailId }: { emailId: string }) {
  const [fetchedReplies, setReplies] = useState<ReplyEmail[]>();
  const [fetchedEmail, setEmail] = useState<Email>();
  const [isLoading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    Promise.all([
      fetchWithSessionToken(`/api/emails/id/${emailId}`),
      fetchWithSessionToken(`/api/replies/email/${emailId}`),
    ])
      .then(([resEmail, resReplies]) =>
        Promise.all([resEmail.json(), resReplies.json()]),
      )
      .then(([emailData, repliesData]) => {
        const { replies } = repliesData;
        const { email } = emailData;
        email.date = new Date(email.date ?? new Date());
        setReplies(replies);
        setEmail(email);
        setLoading(false);
      });
  }, []);

  return (
    <Box sx={{ width: "100%" }}>
      {isLoading ? (
        <></>
      ) : (
        <>
          <Card className="mb-4 p-2 bg-gray-100 rounded-md shadow">
            <CardContent>
              <Typography variant="h6" component="div">
                From: {fetchedEmail!.from}
              </Typography>
              <Typography color="text.secondary">
                To: {fetchedEmail!.to}
              </Typography>
              <Typography color="text.secondary">
                CC: {fetchedEmail!.cc}
              </Typography>
              <Typography color="text.secondary">
                BCC: {fetchedEmail!.bcc}
              </Typography>
              <Typography color="text.secondary">
                Date: {fetchedEmail!.date!.toLocaleString("en-EN")}
              </Typography>
              <Typography color="text.secondary">
                Status: {fetchedEmail!.status}
              </Typography>
              <Typography className="mt-4" color="text.secondary">
                Email Body:
              </Typography>
              <Typography className="pl-2" variant="body2">
                {fetchedEmail!.text}
              </Typography>
              <Typography className="mt-4" color="text.secondary">
                Summary:
              </Typography>
              <Typography className="pl-2" variant="body2">
                {fetchedEmail!.summary}
              </Typography>
            </CardContent>
          </Card>
          <>
            {fetchedReplies && fetchedReplies.length > 0 ? (
              <Stack spacing={2}>
                {fetchedReplies?.map((reply, idx) => {
                  return <ReplyItem key={idx} reply={reply}></ReplyItem>;
                })}
              </Stack>
            ) : (
              <h1>No Emails</h1>
            )}
          </>
        </>
      )}
    </Box>
  );
}
