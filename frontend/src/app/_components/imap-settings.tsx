"use client";

import { fetchWithSessionToken } from "@/utils/client_fetcher";
import { computeSharedSecret, encrypt, generateECDHKeys } from "@/utils/crypto";
import { useEffect } from "react";
import { useState } from "react";
import { TextField, Button, Paper } from "@mui/material";
import * as uuid from "uuid";

export default function ImapSettings() {
  const [password, setPassword] = useState<string>("");
  const [host, setHost] = useState<string>("");
  const [port, setPort] = useState<string>("993");

  useEffect(() => {
    fetchWithSessionToken("/api/settings", { method: "GET" })
      .then((res) => res.json())
      .then((data) => {
        const { host, port } = data;
        setHost(host ?? "");
        setPort((port ?? "") + "");
      });
  }, []);

  const handleSubmit = async () => {
    const myUuid = uuid.v4();
    const { public_key: serverPublicKey } = await fetchWithSessionToken(
      "/api/settings/dh",
      {
        method: "POST",
        body: JSON.stringify({
          uuid: myUuid,
        }),
      },
    ).then((res) => res.json());
    const { privateKey: myPrivateKey, publicKey: myPublicKey } =
      await generateECDHKeys();
    const sharedSecret = await computeSharedSecret(
      myPrivateKey,
      serverPublicKey,
    );
    const { iv, cipherText } = await encrypt(sharedSecret, password);
    await fetchWithSessionToken("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        password: cipherText,
        host,
        port: port + "",
        uuid: myUuid,
        iv,
        public_key: myPublicKey,
      }),
    });
  };

  return (
    <Paper className="p-4 mx-auto mt-20 max-w-md" elevation={3}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <TextField
          className="mb-4"
          label="Password"
          variant="outlined"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          className="mb-4"
          label="Host"
          variant="outlined"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <TextField
          className="mb-4"
          label="Port"
          variant="outlined"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          className="self-end"
        >
          Save
        </Button>
      </form>
    </Paper>
  );
}
