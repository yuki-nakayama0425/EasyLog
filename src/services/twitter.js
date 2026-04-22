const { TwitterApi } = require('twitter-api-v2');

function getClient() {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return null;

  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
}

async function postTweet(text) {
  const client = getClient();
  if (!client) return { skipped: true, reason: 'X credentials not configured' };

  const rwClient = client.readWrite;
  const tweet = await rwClient.v2.tweet(text);
  return { success: true, tweetId: tweet.data.id };
}

module.exports = { postTweet };
