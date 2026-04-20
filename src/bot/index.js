const { Telegraf } = require('telegraf');
const supabase = require('../db/supabase');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('EasyLogへようこそ！\nテキスト・画像・位置情報を送るだけで、毎晩旅行記を自動生成します。');
});

bot.on('text', async (ctx, next) => {
  const userId = String(ctx.from.id);
  const text = ctx.message.text;
  if (text.startsWith('/')) return next();

  const { error } = await supabase.from('posts').insert({
    user_id: userId,
    text,
  });

  if (error) {
    console.error('DB save error:', error);
    ctx.reply('保存に失敗しました。');
  } else {
    ctx.reply('記録しました！');
  }
});

bot.on('photo', async (ctx) => {
  const userId = String(ctx.from.id);
  const caption = ctx.message.caption || '';
  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id;

  const { error } = await supabase.from('posts').insert({
    user_id: userId,
    text: caption,
    file_id: fileId,
  });

  if (error) {
    console.error('DB save error:', error);
    ctx.reply('保存に失敗しました。');
  } else {
    ctx.reply('画像を記録しました！');
  }
});

bot.on('location', async (ctx) => {
  const userId = String(ctx.from.id);
  const { latitude, longitude } = ctx.message.location;

  const { error } = await supabase.from('posts').insert({
    user_id: userId,
    location_lat: latitude,
    location_lng: longitude,
  });

  if (error) {
    console.error('DB save error:', error);
    ctx.reply('保存に失敗しました。');
  } else {
    ctx.reply('位置情報を記録しました！');
  }
});

module.exports = bot;
