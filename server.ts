import express from "express";
import axios from "axios";
import { Pool } from "pg";
import { findAllValuesByKey, makeId, unixToDateTime } from "./utils";
import { query } from "./db";
import https from 'https';
import fs from 'fs';
import path from 'path';

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const { WEBHOOK_VERIFY_TOKEN } = process.env;

app.use(express.json());

// Create a pool of database connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.post("/whatsapp-webhook", async (req: any, res: any) => {
  const body = req.body;
  console.log("Incoming webhook message:", JSON.stringify(body, null, 2));

  const id = body.entry?.[0].id;
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const status = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];

  if (message?.type === "text") {
    const business_phone_number_id =
      body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

    try {
      const phoneNumberId = findAllValuesByKey(body, "phone_number_id")[0];

      const whatsAppPhoneResult = await query(
        'SELECT * FROM "WhatsAppPhone" WHERE "phoneId" = $1;',
        [phoneNumberId]
      );
      const whatsAppPhone = whatsAppPhoneResult.rows[0];

      if (!whatsAppPhone) {
        console.error("WhatsApp phone not found for " + phoneNumberId);
      }

      const whatsAppAccountResult = await query(
        'SELECT * FROM "WhatsAppAccount" WHERE "whatsAppAccountId" = $1;',
        [whatsAppPhone.whatsAppAccountId]
      );
      const whatsAppAccount = whatsAppAccountResult.rows[0];

      if (!whatsAppAccount) {
        console.error(
          "Organization not found for " + whatsAppPhone.organizationId
        );
      }

      const organizationResult = await query(
        'SELECT * FROM "Organization" WHERE "id" = $1;',
        [whatsAppAccount.organizationId]
      );
      const organization = organizationResult.rows[0];

      if (!organization) {
        console.error(
          "Organization not found for " + whatsAppPhone.organizationId
        );
      }

      const leadResult = await query(
        'SELECT * FROM "Lead" WHERE "phone" = $1 AND "organizationId" = $2;',
        [message.from, organization.id]
      );
      const lead = leadResult.rows[0];

      if (!lead) {
        console.error("Lead not found");
      }

      await query(
        'INSERT INTO "WhatsAppMessage" (id, "wamId", "leadId", "sender_phone_number", "sender_phone_number_id", "reciever_phone_number_id", "message", "messageType", "isSentMessage", "timestamp") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
        [
          makeId(20),
          message.id,
          lead.id,
          message.from,
          business_phone_number_id,
          id,
          message.text.body,
          message.type,
          false,
          unixToDateTime(message.timestamp),
        ]
      );

      // Mark incoming message as read
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v20.0/${business_phone_number_id}/messages`,
        headers: {
          Authorization: `Bearer ${whatsAppAccount.accessToken}`,
        },
        data: {
          messaging_product: "whatsapp",
          status: "read",
          message_id: message.id,
        },
      });

      res.sendStatus(200);
    } catch (error) {
      console.error("Error sending message:", error);
      res.sendStatus(500);
    }
  } else if (status?.conversation.origin.type === "marketing" || status?.conversation.origin.type === "service") {
    if (status.status === "delivered") {
      await query(
        'UPDATE "WhatsAppMessage" SET "isDelivered" = true WHERE "wamId" = $1;',
        [status.id.toString()]
      );
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(200);
  }
});

app.get("/whatsapp-webhook", (req: any, res: any) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Read the SSL/TLS certificate and key
const key = fs.readFileSync(path.resolve(__dirname, 'server.key'), 'utf8');
const cert = fs.readFileSync(path.resolve(__dirname, 'server.cert'), 'utf8');
const credentials = { key, cert };

// Create an HTTPS server with the Express app and the credentials
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
