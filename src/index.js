require('dotenv').config();
const express = require('express');
const bot = require('./bot');
const generateRoute = require('./routes/generate');
const { runGenerate } = require('./routes/generate');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.use('/generate', generateRoute(bot));

bot.command('xtest', async (ctx) => {
  const allowedId = process.env.TELEGRAM_USER_ID;
  if (String(ctx.from.id) !== allowedId) return;
  await ctx.reply('Xへのテスト投稿を試みます...');
  try {
    const { postTweet } = require('./services/twitter');
    const result = await postTweet('EasyLog テスト投稿 ' + new Date().toISOString());
    await ctx.reply(`✅ 成功！\nhttps://x.com/i/web/status/${result.tweetId}`);
  } catch (err) {
    const fullError = JSON.stringify({ message: err.message, code: err.code, data: err.data }, null, 2);
    await ctx.reply(`⚠️ 失敗:\n${fullError.slice(0, 500)}`);
  }
});

bot.command('generate', async (ctx) => {
  const allowedId = process.env.TELEGRAM_USER_ID;
  if (String(ctx.from.id) !== allowedId) return;
  const args = ctx.message.text.split(' ');
  const date = args[1] || null; // e.g. /generate 2026-04-23
  await ctx.reply(`記事を生成中です...${date ? `（${date}）` : ''}`);
  try {
    const result = await runGenerate(bot, date);
    if (result.message) await ctx.reply(result.message);
  } catch (err) {
    console.error('Generate command error:', err);
    await ctx.reply('生成に失敗しました。');
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/debug/posts', async (req, res) => {
  const supabase = require('./db/supabase');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('posts')
    .select('id, text, file_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ today: today.toISOString(), count: data.length, posts: data });
});


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
