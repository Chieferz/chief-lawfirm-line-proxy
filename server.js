/**
 * Chief Law Firm — LINE Proxy Server
 * Deploy บน Render.com (Free Tier)
 *
 * Endpoints:
 *   GET  /               → Health check
 *   POST /sendLineMessage → Proxy ส่ง LINE Push Message
 *   POST /lineWebhook     → รับ Webhook จาก LINE Developer Console
 */

const express = require("express");
const axios   = require("axios");
const crypto  = require("crypto");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());

// CORS — อนุญาตทุก origin (Firebase Hosting + localhost)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Health Check ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status : "ok",
    service: "Chief Law Firm — LINE Proxy",
    time   : new Date().toISOString(),
  });
});

// ── 1) POST /sendLineMessage  (Proxy → LINE Push API) ───────────────────────
//
//  Body (JSON):
//    token    : Channel Access Token
//    to       : User ID หรือ Group ID
//    messages : array of LINE message objects  [{ type:"text", text:"..." }]
//
app.post("/sendLineMessage", async (req, res) => {
  const { token, to, messages } = req.body || {};

  if (!token || !to || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "กรุณาส่ง token, to, messages[] ให้ครบ",
    });
  }

  try {
    const response = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      { to, messages },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.status(200).json({ success: true, lineStatus: response.status });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[sendLineMessage] error:", detail);
    return res.status(500).json({ error: "LINE API error", detail });
  }
});

// ── 2) POST /lineWebhook  (รับ Event จาก LINE) ─────────────────────────────
//
//  LINE จะส่ง POST มาที่ URL นี้เมื่อมีคนพิมพ์ใน Chat
//  Bot จะตอบกลับ User ID อัตโนมัติ (เพื่อใช้ตั้งค่าในแอป)
//
app.post("/lineWebhook", async (req, res) => {
  // ตอบ 200 ก่อนเสมอ — LINE จะ retry ถ้าไม่ได้รับ 200 ภายใน 1 วินาที
  res.sendStatus(200);

  const channelSecret     = process.env.LINE_CHANNEL_SECRET     || "";
  const channelAccessToken= process.env.LINE_CHANNEL_ACCESS_TOKEN|| "";

  // ── Signature Verify (ถ้ามี secret) ──────────────────────────────────────
  if (channelSecret) {
    const sig = req.headers["x-line-signature"] || "";
    const body= JSON.stringify(req.body);
    const hash= crypto
      .createHmac("sha256", channelSecret)
      .update(body)
      .digest("base64");
    if (sig !== hash) {
      console.warn("[lineWebhook] Signature mismatch — ignored");
      return;
    }
  }

  const events = req.body?.events || [];
  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const userId  = event.source?.userId  || "(ไม่มี userId)";
    const groupId = event.source?.groupId || null;
    const text    = event.message.text.trim().toLowerCase();

    // ถ้าพิมพ์ "myid" หรือ "userid" หรือ "id" — ตอบ ID กลับ
    const trigger = ["myid","userid","id","ไอดี","userid?","เบอร์"].includes(text);

    if (trigger && channelAccessToken) {
      let replyText = `🆔 User ID ของคุณ:\n${userId}`;
      if (groupId) replyText += `\n\n👥 Group ID:\n${groupId}`;
      replyText += "\n\n📋 คัดลอก ID นี้ไปวางในแอป Chief Law Firm ที่หน้าตั้งค่า LINE ได้เลยครับ";

      await axios
        .post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: event.replyToken,
            messages: [{ type: "text", text: replyText }],
          },
          {
            headers: {
              Authorization: `Bearer ${channelAccessToken}`,
              "Content-Type": "application/json",
            },
          }
        )
        .catch((e) => console.error("[lineWebhook] reply error:", e.response?.data || e.message));
    }
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  LINE Proxy server running on port ${PORT}`);
});
