import express from "express";
import { Database } from "../../databases/base.js";
import logger from "../../logger/bunyan.js";
import {
  generateECDHKeys,
  computeSharedSecret,
  decrypt,
} from "../../utils/crypto.js";
import _ from "lodash";

export function buildSettingsRoutes(db: Database) {
  const router = express.Router();
  router.post("/dh", async (req, res) => {
    const {
      body: { uuid },
    } = req;
    if (!uuid) {
      logger.error("Failed settings request: need uuid!!!");
      res.status(403).send({ error: "Failed settings request: need uuid!!!" });
      return;
    }

    const { publicKey, privateKey } = await generateECDHKeys();
    await db.insertTempKeys(uuid, { publicKey, privateKey });
    res.status(200).send({ public_key: publicKey });
  });

  router.get("/", async (req, res) => {
    const {
      body: { user_id: userId },
    } = req;
    if (!userId) {
      logger.error("Failed settings request: Unauthorized empty user");
      res
        .status(403)
        .send({ error: "Failed settings request: Unauthorized empty user" });
      return;
    }

    try {
      const imapSettings = await db.getUserImapSettings(userId);
      let retVal = {};
      if (imapSettings) {
        const { host, port, imap_settings: authSettings } = imapSettings;
        retVal = { host, port, imap_settings: authSettings };
      }
      logger.info(`Fetched imap settings for user: ${userId}`);
      res.status(200).send(retVal);
    } catch (error) {
      logger.error(`Failed to fetch imap settings for user: ${userId}`, error);
      res.status(500).send(JSON.stringify(error));
    }
  });

  router.post("/", async (req, res) => {
    const {
      body: {
        password,
        user_id: userId,
        host,
        port,
        key_uuid: keyUuid,
        iv,
        public_key: publicKey,
      },
    } = req;
    if (!userId) {
      logger.error("Failed settings request: Unauthorized empty user");
      res
        .status(403)
        .send({ error: "Failed settings request: Unauthorized empty user" });
      return;
    }
    let data: {
      imap_password?: string;
      imap_host?: string;
      imap_port?: string;
      imap_settings?: Record<string, any>;
    } = {};
    if (password) {
      const keyPair = await db.getTempKeys(keyUuid);
      if (!keyPair) {
        logger.error("Failed settings request: Unauthorized empty user");
        res
          .status(403)
          .send({ error: "Failed settings request: Unauthorized empty user" });
        return;
      }
      try {
        const sharedKey = await computeSharedSecret(keyPair.private_key, publicKey);
        data["imap_password"] = decrypt(password, iv, undefined, sharedKey);
      } catch (error) {
        logger.error("Failed settings request: Decryption failed");
        res
          .status(403)
          .send({ error: "Failed settings request: Decryption failed" });
        return;
      }
    }

    if (host) {
      data["imap_host"] = host;
    }
    if (port) {
      data["imap_port"] = port;
    }

    if (_.isEmpty(data)) {
      logger.error("Failed settings request: No data to update");
      res
        .status(403)
        .send({ error: "Failed settings request: No data to update" });
      return;
    }

    data["imap_settings"] = {
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };

    try {
      await Promise.all([
        db.setUserImapSettings(userId, data),
        db.deleteTempKey(keyUuid),
      ]);
      logger.info(`Updated imap settings for user: ${userId}`);
      res.status(200).send({ status: "ok" });
      return;
    } catch (error) {
      logger.error(`Failed to update imap settings for user: ${userId}`, error);
      res.status(500).send(JSON.stringify(error));
      return;
    }
  });

  return router;
}
