const express = require('express');

const LINE_TOKEN = 'lR/YjurfaJerQT19fssnf229ZouyU1VKWdOu/8SqDWkM4qGFr8tcPp7kTZ7Lq3FvZvHPrc10Rekgx/z4PV0BXAS1kCQjubkhs83WzpzWFooQFc/oL02XzB4DcI005JwutDZwZDignkUxAYImV6Q9yQdB04t89/1O/w1cDnyilFU=';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Chief Law Firm LINE Proxy', version: '2.0' });
});

app.post('/lineWebhook', async (req, res) => {
    const body = req.body;
    res.status(200).send('OK');
    for (const ev of (body.events || [])) {
          if (ev.type === 'message' && ev.source && ev.source.userId && ev.replyToken) {
                  const userId = ev.source.userId;
                  const groupId = ev.source.groupId || null;
                  const isGroup = ev.source.type === 'group' || ev.source.type === 'room';
                  const replyText = isGroup
                    ? ('✅ Chief Law Firm System\n\n👥 Group ID:\n' + groupId + '\n\n👤 User ID:\n' + userId)
                            : ('✅ Chief Law Firm System\n\n🆔 LINE User ID:\n' + userId + '\n\nคัดลอก ID นี้ใส่หน้าตั้งค่า LINE ในระบบ Chief Law Firm');
                  try {
                            await fetch('https://api.line.me/v2/bot/message/reply', {
                                        method: 'POST',
                                        headers: { 'Authorization': 'Bearer ' + LINE_TOKEN, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: 'text', text: replyText }] }),
                            });
                  } catch (e) { console.error('Reply error:', e.message); }
          }
    }
});

app.post('/sendLineMessage', async (req, res) => {
    const { token, to, messages } = req.body;
    if (!token || !to || !Array.isArray(messages)) {
          return res.status(400).json({ error: 'Missing fields: token, to, messages' });
    }
    try {
          const r = await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ to, messages }),
          });
          res.status(r.status).send(await r.text());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;
