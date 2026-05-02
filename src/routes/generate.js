const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { generateArticle, generateThreadText, generateXText } = require('../services/gemini');
const { postTweet } = require('../services/twitter');

// Parse timezone string like "+06:00" or "-05:30" into milliseconds offset.
function parseTzOffset(tzStr) {
  const match = tzStr && tzStr.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (parseInt(match[2]) * 60 + parseInt(match[3])) * 60 * 1000;
}

// dateStr: 'YYYY-MM-DD'. tzStr: '+06:00' etc. Both default to JST if omitted.
async function runGenerate(bot, dateStr = null, tzStr = null) {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const tzOffset = parseTzOffset(tzStr) ?? JST_OFFSET;

  let targetDate;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    targetDate = new Date(Date.UTC(y, m - 1, d) - tzOffset);
  } else {
    const nowLocal = new Date(Date.now() + tzOffset);
    targetDate = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - tzOffset);
  }
  const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  const dateLabel = new Date(targetDate.getTime() + tzOffset).toISOString().split('T')[0];

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .gte('created_at', targetDate.toISOString())
    .lt('created_at', nextDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!posts || posts.length === 0) return { message: `${dateLabel} の投稿がありません。` };

  const article = await generateArticle(posts, dateLabel);

  const { error: saveError } = await supabase.from('articles').upsert(
    { content: article, date: dateLabel },
    { onConflict: 'date' }
  );
  if (saveError) throw saveError;

  const threadText = await generateThreadText(posts, article, dateLabel);
  const xText = await generateXText(posts, article, dateLabel);

  const userId = process.env.TELEGRAM_USER_ID;
  if (bot && userId) {
    let photoCount = 0;
    for (const post of posts) {
      if (post.file_id) {
        photoCount++;
        try {
          await bot.telegram.sendPhoto(userId, post.file_id, { caption: `📷 写真${photoCount}` });
        } catch (photoErr) {
          console.error(`sendPhoto error (写真${photoCount}):`, photoErr.message);
        }
      }
    }

    const firstNewline = article.indexOf('\n');
    const articleTitle = firstNewline !== -1 ? article.slice(0, firstNewline).trim() : article.trim();
    const articleBody = firstNewline !== -1 ? article.slice(firstNewline + 1).trimStart() : '';

    const TELEGRAM_MAX = 4096;
    const sendLong = async (text) => {
      for (let i = 0; i < text.length; i += TELEGRAM_MAX) {
        await bot.telegram.sendMessage(userId, text.slice(i, i + TELEGRAM_MAX));
      }
    };

    await bot.telegram.sendMessage(userId, articleTitle);
    if (articleBody) await sendLong(articleBody);
    await sendLong(threadText);
    await bot.telegram.sendMessage(userId, `🐦 X用（140文字以内）\n\n${xText}`);

    try {
      const tweetResult = await postTweet(xText);
      if (tweetResult.success) {
        await bot.telegram.sendMessage(userId, `✅ Xに自動投稿しました。\nhttps://x.com/i/web/status/${tweetResult.tweetId}`);
      } else if (!tweetResult.skipped) {
        await bot.telegram.sendMessage(userId, '⚠️ X投稿に失敗しました。手動で投稿してください。');
      }
    } catch (tweetErr) {
      const fullError = JSON.stringify({
        message: tweetErr.message,
        code: tweetErr.code,
        data: tweetErr.data,
        errors: tweetErr.errors,
      }, null, 2);
      console.error('Twitter post error:', fullError);
      await bot.telegram.sendMessage(userId, `⚠️ X投稿失敗:\n${fullError.slice(0, 500)}`);
    }
  }

  return { success: true, article, threadText };
}

const createRouter = (bot) => {
  router.post('/', async (req, res) => {
    try {
      const date = req.query.date || req.body.date || null;
      const result = await runGenerate(bot, date);
      res.json(result);
    } catch (err) {
      console.error('Generate error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const date = req.query.date || null;
      const result = await runGenerate(bot, date);
      res.json(result);
    } catch (err) {
      console.error('Generate error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

module.exports = createRouter;
module.exports.runGenerate = runGenerate;
