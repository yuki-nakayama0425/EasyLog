const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const promptTemplate = fs.readFileSync(
  path.join(__dirname, '../../docs/生成プロンプトv1'),
  'utf8'
);

function getTripDay() {
  const start = new Date('2026-01-28T00:00:00+09:00');
  const now = new Date();
  const diffMs = now - start;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

async function generateArticle(posts) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const tripDay = getTripDay();

  let photoCount = 0;
  const logsText = posts
    .map((p) => {
      const parts = [];
      if (p.created_at) parts.push(`日時: ${new Date(p.created_at).toLocaleString('ja-JP')}`);
      if (p.text) parts.push(`内容: ${p.text}`);
      if (p.file_id) {
        photoCount++;
        parts.push(`画像: [写真${photoCount}]`);
      }
      if (p.location_lat) parts.push(`場所: https://www.google.com/maps?q=${p.location_lat},${p.location_lng}`);
      if (p.emotion) parts.push(`感情: ${p.emotion}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');

  const imageRule = photoCount > 0 ? `
# 画像プレースホルダー（必須）
ログ中の「画像: [写真N]」が登場する位置の近くに、必ず「📷 [写真N]」の形式で本文中に挿入すること。
例：📷 [写真1]、📷 [写真2]
存在しない写真番号は絶対に作らないこと。写真は全部で${photoCount}枚。
` : '';

  const titleRule = `\n# TITLE PREFIX（必須）\nタイトルの先頭に必ず「【世界一周${tripDay}日目・国名】」をつけること。国名はログの内容から判断する。\n例：【世界一周83日目・スリランカ】コロンボで食べた安飯のこと\n`;

  const prompt = promptTemplate.split('{logs}').join(logsText) + imageRule + titleRule;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { generateArticle };
