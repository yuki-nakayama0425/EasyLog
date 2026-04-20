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

app.use('/generate', generateRoute(bot));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/debug/posts', async (req, res) => {
  const supabase = require('./db/supabase');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('posts')
    .select('id, text, file_id, created_at')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ today: today.toISOString(), count: data.length, posts: data });
});

// 毎日22:00に記事生成
cron.schedule('0 22 * * *', async () => {
  console.log('Running daily article generation...');
  try {
    const res = await fetch(`http://localhost:${PORT}/generate`, { method: 'POST' });
    const data = await res.json();
    console.log('Article generated:', data.success);
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
