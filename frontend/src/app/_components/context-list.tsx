"use client";

import { useState } from "react";
import { Button, TextField, IconButton, Alert } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Snackbar from "@mui/material/Snackbar";
import { fetchWithSessionToken } from "@/utils/client_fetcher";

interface Context {
  id?: string;
  key: string;
  value: string;
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Context[]>([{ key: "", value: "" }]);
  const [snackbar, openSnackbar] = useState<boolean>(false);

  const handleInputChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const values = [...settings];
    if (event.target.name === "key") {
      values[index].key = event.target.value;
    } else {
      values[index].value = event.target.value;
    }
    setSettings(values);
  };

  const handleAddFields = () => {
    setSettings([...settings, { key: "", value: "" }]);
  };

  const handleRemoveFields = async (index: number) => {
    const values = [...settings];
    values.splice(index, 1);
    setSettings(values);
    if (settings[index].id) {
      try {
        const response = await fetchWithSessionToken(
          `/api/contexts/${settings[index].id}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }

        // If you expect any response from the server
        // const data = await response.json();
        // console.log(data);
      } catch (error) {
        console.error("Request failed: ", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetchWithSessionToken("/api/contexts", {
        method: "POST",
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      // If you expect any response from the server
      // const data = await response.json();
      // console.log(data);
    } catch (error) {
      console.error("Request failed: ", error);
    }
  };

  const handleClose = () => {
    openSnackbar(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        {settings.map((setting, index) => (
          <div key={index} className="flex items-center mb-3">
            <TextField
              name="key"
              label="Key"
              variant="outlined"
              value={setting.key}
              onChange={(event) => handleInputChange(index, event)}
              className="mr-2"
            />
            <TextField
              name="value"
              label="Value"
              variant="outlined"
              value={setting.value}
              onChange={(event) => handleInputChange(index, event)}
              className="mr-2"
            />
            <IconButton
              onClick={() => handleRemoveFields(index)}
              color="secondary"
              aria-label="remove setting"
            >
              <DeleteIcon />
            </IconButton>
          </div>
        ))}
        <Button
          variant="contained"
          color="primary"
          onClick={handleAddFields}
          className="mr-2"
        >
          Add Context
        </Button>
        <Button variant="contained" color="primary" type="submit">
          Submit
        </Button>
      </form>
      <Snackbar open={snackbar} onClose={handleClose} autoHideDuration={5000}>
        <Alert severity="success" onClose={handleClose} sx={{ width: "100%" }}>
          We good!!
        </Alert>
      </Snackbar>
    </>
  );
}
