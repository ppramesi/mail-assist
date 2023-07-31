"use server";

import { Email } from "./types/email";
import { Card, CardContent, Typography } from '@mui/material';

export default function EmailItem({ email }: { email: Email }){
  const date = new Date(email.date ?? new Date())
  return (
    <Card className="mb-4 p-2 bg-gray-100 rounded-md shadow">
      <CardContent>
        <Typography variant="h6" component="div">
          From: {email.from}
        </Typography>
        <Typography color="text.secondary">
          To: {email.to}
        </Typography>
        <Typography color="text.secondary">
          CC: {email.cc}
        </Typography>
        <Typography color="text.secondary">
          BCC: {email.bcc}
        </Typography>
        <Typography color="text.secondary">
          Date: {date.toLocaleString("en-EN")}
        </Typography>
        <Typography color="text.secondary">
          Status: {email.status}
        </Typography>
        <Typography className="mt-4" color="text.secondary">
          Email Body:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {email.text}
        </Typography>
        <Typography className="mt-4" color="text.secondary">
          Summary:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {email.summary}
        </Typography>
      </CardContent>
    </Card>
  );
}