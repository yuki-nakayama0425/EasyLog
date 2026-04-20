const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateArticle(posts) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const logsText = posts
    .map((p, i) => {
      const parts = [];
      if (p.created_at) parts.push(`日時: ${new Date(p.created_at).toLocaleString('ja-JP')}`);
      if (p.text) parts.push(`内容: ${p.text}`);
      if (p.image_url) parts.push(`画像ID: [写真${i + 1}]`);
      if (p.location_lat) parts.push(`場所: 緯度${p.location_lat} 経度${p.location_lng}`);
      if (p.emotion) parts.push(`感情: ${p.emotion}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');

  const prompt = `以下は1日の旅行ログです。これをもとに、note風の旅行記を作成してください。

要件：
・時系列で整理
・自然なストーリーにする
・感情を補完する
・読者が旅行したくなる内容
・エモい文章
・画像IDがある場合は、文章の中の適切な位置に「📷 [写真N]」という形式でそのまま挿入すること

構成：
・タイトル
・導入文
・本文（画像プレースホルダーを適切な位置に含める）
・まとめ
・ハッシュタグ

---

${logsText}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { generateArticle };
