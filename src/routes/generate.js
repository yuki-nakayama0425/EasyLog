const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { generateArticle } = require('../services/gemini');

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
  }

  return { success: true, article };
}

module.exports = (bot) => {
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
