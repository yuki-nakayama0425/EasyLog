const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const promptTemplate = fs.readFileSync(
  path.join(__dirname, '../../docs/生成プロンプトv1'),
  'utf8'
);

async function generateArticle(posts) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
      if (p.location_lat) parts.push(`場所: 緯度${p.location_lat} 経度${p.location_lng}`);
      if (p.emotion) parts.push(`感情: ${p.emotion}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');

  const imageRule = `
# 画像プレースホルダー（必須）
本文中の画像が挿入されるべき位置に、必ず「📷 [写真N]」の形式で挿入すること。
例：📷 [写真1]、📷 [写真2]
これはnoteに貼り付ける際の位置指示として使用する。
`;

  const prompt = promptTemplate.split('{logs}').join(logsText) + imageRule;

  console.log('=== LOGS SENT TO GEMINI ===');
  console.log(logsText);
  console.log('===========================');

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { generateArticle };
