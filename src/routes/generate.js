const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { generateArticle } = require('../services/gemini');

router.post('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!posts || posts.length === 0) {
      return res.json({ message: '本日の投稿がありません。' });
    }

    const article = await generateArticle(posts);

    const { error: saveError } = await supabase.from('articles').insert({
      content: article,
      date: today.toISOString().split('T')[0],
    });

    if (saveError) throw saveError;

    res.json({ success: true, article });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
