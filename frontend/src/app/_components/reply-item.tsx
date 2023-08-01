"use client";

import { PotentialReplyEmail } from "./types/reply";
import { Card, CardContent, Typography } from '@mui/material';

export default function ReplyItem({ reply }: { reply: PotentialReplyEmail }) {
  return (
    <Card className="mb-4 p-2 bg-gray-100 rounded-md shadow">
      <CardContent>
        <Typography className="mt-4" color="text.secondary">
          Summary:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {reply.summary}
        </Typography>
        <Typography className="mt-4" color="text.secondary">
          Intention:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {reply.intention}
        </Typography>
        <Typography className="mt-4" color="text.secondary">
          Reply Text:
        </Typography>
        <Typography className="pl-2" variant="body2">
          {reply.reply_text}
        </Typography>
      </CardContent>
    </Card>
  );
}