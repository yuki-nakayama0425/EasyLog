require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const bot = require('./bot');
const generateRoute = require('./routes/generate');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.use('/generate', generateRoute);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 毎日22:00に記事生成
cron.schedule('0 22 * * *', async () => {
  console.log('Running daily article generation...');
  try {
    const res = await fetch(`http://localhost:${PORT}/generate`, { method: 'POST' });
    const data = await res.json();
    console.log('Article generated:', data.success);

    if (data.article && process.env.TELEGRAM_USER_ID) {
      await bot.telegram.sendMessage(process.env.TELEGRAM_USER_ID, data.article);
    }
  } catch (err) {
    console.error('Cron error:', err);
  }
}, { timezone: 'Asia/Tokyo' });

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (WEBHOOK_URL) {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log(`Webhook set to ${WEBHOOK_URL}/webhook`);
  } else {
    bot.launch();
    console.log('Bot started in polling mode');
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
