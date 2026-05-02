const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const promptTemplate = fs.readFileSync(
  path.join(__dirname, '../../docs/生成プロンプトv1'),
  'utf8'
);

async function withRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is503 = err.message && err.message.includes('503');
      if (!is503 || attempt === retries) throw err;
      const wait = attempt * 10000;
      console.log(`Gemini 503, retrying in ${wait / 1000}s (attempt ${attempt}/${retries})`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

function getTripDay(dateLabel) {
  const start = new Date(`${process.env.TRIP_START_DATE}T00:00:00+09:00`);
  const target = dateLabel
    ? new Date(`${dateLabel}T00:00:00+09:00`)
    : new Date(Date.now() + 9 * 60 * 60 * 1000);
  const diffMs = target - start;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

async function generateArticle(posts, dateLabel) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  const tripDay = getTripDay(dateLabel);

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

  const result = await withRetry(() => model.generateContent(prompt));
  return result.response.text()
    .replace(/^【タイトル】\n?/m, '')
    .replace(/^【本文】\n?/m, '')
    .replace(/^【ハッシュタグ】\n?/m, '')
    .trim();
}

async function generateThreadText(posts, article, dateLabel) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  const tripDay = getTripDay(dateLabel);

  const prompt = `以下は世界一周${tripDay}日目の旅行記事と元のログです。これをもとにスレッド（Threads）用の投稿テキストを1つ作成してください。

# 元記事
${article}

# ルール
- 500文字以内の1投稿
- その日の一番印象的な出来事を中心に
- ハッシュタグは一切含めない
- 画像プレースホルダー（📷）は含めない
- AIっぽい表現禁止（「〜だと感じました」「まさに〜」など）
- 普通の人間がつぶやくような自然な口語体
- 絵文字は一切使わない`;

  const result = await withRetry(() => model.generateContent(prompt));
  return result.response.text();
}

async function generateXText(posts, article, dateLabel) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  const tripDay = getTripDay(dateLabel);

  const prefix = `DAY${tripDay} `;
  const limit = 140 - prefix.length;

  const prompt = `以下は世界一周${tripDay}日目の旅行記事と元のログです。これをもとにX（旧Twitter）の投稿用テキストを1つ作成してください。

# 元記事
${article}

# ルール
- 【厳守】${limit}文字以内（冒頭に「${prefix}」が自動付加されるため）
- その日の一番印象的な出来事を中心に
- 最後に「#世界一周」のハッシュタグのみ
- 画像プレースホルダー（📷）は含めない
- AIっぽい表現禁止（「〜だと感じました」「まさに〜」など）
- 普通の人間がつぶやくような自然な口語体
- URLは含めない
- 「DAY〇」は出力しない（自動で付加される）`;

  const result = await withRetry(() => model.generateContent(prompt));
  // Remove newlines so Twitter doesn't count them as extra characters
  const body = result.response.text().replace(/\s+/g, ' ').trim();
  const full = prefix + (body.length > limit ? body.slice(0, limit - 3) + '...' : body);
  return full.length > 140 ? full.slice(0, 137) + '...' : full;
}

module.exports = { generateArticle, generateThreadText, generateXText };
