"use client";

import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { fetchWithSessionToken } from "@/utils/client_fetcher";
import ReplyItem from "./reply-item";
import { PotentialReplyEmail } from "./types/reply";
import { useEffect, useState } from "react";
import { Email } from "./types/email";
import { Card, CardContent, Typography } from '@mui/material';

export default function ReplyList({ emailId, email, replies }: { emailId?: string, email?: Email, replies?: PotentialReplyEmail[] }){
  if(email && replies){
    const date = new Date(email.date ?? new Date())
    return(
      <Box sx={{ width: "100%" }}>
        <Card className="mb-4 p-2 bg-gray-100 rounded-md shadow">
          <CardContent>
            <Typography variant="h6" component="div">
              From: {email!.from}
            </Typography>
            <Typography color="text.secondary">
              To: {email!.to}
            </Typography>
            <Typography color="text.secondary">
              CC: {email!.cc}
            </Typography>
            <Typography color="text.secondary">
              BCC: {email!.bcc}
            </Typography>
            <Typography color="text.secondary">
              Date: {date.toLocaleString("en-EN")}
            </Typography>
            <Typography color="text.secondary">
              Status: {email!.status}
            </Typography>
            <Typography className="mt-4" color="text.secondary">
              Email Body:
            </Typography>
            <Typography className="pl-2" variant="body2">
              {email!.text}
            </Typography>
            <Typography className="mt-4" color="text.secondary">
              Summary:
            </Typography>
            <Typography className="pl-2" variant="body2">
              {email!.summary}
            </Typography>
          </CardContent>
        </Card>
        <Stack spacing={2}>
          {replies?.map((reply, idx) => <ReplyItem key={idx} reply={reply}></ReplyItem>)}
        </Stack>
      </Box>
    );
  }else if(emailId){
    const [fetchedReplies, setReplies] = useState<PotentialReplyEmail[]>()
    const [fetchedEmail, setEmail] = useState<Email>()
    const [isLoading, setLoading] = useState<boolean>(true)
    useEffect(() => {
      Promise.all([
        fetchWithSessionToken(`/api/emails/id/${emailId}`),
        fetchWithSessionToken(`/api/replies/email/${emailId}`)
      ])
        .then(([resEmail, resReplies]) => Promise.all([resEmail.json(), resReplies.json()]))
        .then(([emailData, repliesData]) => {
          const { replies } = repliesData
          const { email } = emailData
          email.date = new Date(email.date ?? new Date())
          setReplies(replies)
          setEmail(email)
          setLoading(false)
        })
    }, [])
  
    return(
      <Box sx={{ width: "100%" }}>
        { isLoading ? <></> : <>
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
          <Stack spacing={2}>
            {fetchedReplies?.map((reply, idx) => {
              return <ReplyItem key={idx} reply={reply}></ReplyItem>
            })}
          </Stack>
        </> }
      </Box>
    );
  }else{
    return <></>;
  }
}