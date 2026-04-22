const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { generateArticle, generateThreadText } = require('../services/gemini');
const { postTweet } = require('../services/twitter');

async function runGenerate(bot) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!posts || posts.length === 0) return { message: '本日の投稿がありません。' };

  const article = await generateArticle(posts);

  const { error: saveError } = await supabase.from('articles').insert({
    content: article,
    date: today.toISOString().split('T')[0],
  });
  if (saveError) throw saveError;

  const threadText = await generateThreadText(posts, article);

  const userId = process.env.TELEGRAM_USER_ID;
  if (bot && userId) {
    let photoCount = 0;
    for (const post of posts) {
      if (post.file_id) {
        photoCount++;
        await bot.telegram.sendPhoto(userId, post.file_id, { caption: `📷 写真${photoCount}` });
      }
    }

    await bot.telegram.sendMessage(userId, article);
    await bot.telegram.sendMessage(userId, threadText);

    try {
      const tweetResult = await postTweet(threadText);
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
      const result = await runGenerate(bot);
      res.json(result);
    } catch (err) {
      console.error('Generate error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const result = await runGenerate(bot);
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
