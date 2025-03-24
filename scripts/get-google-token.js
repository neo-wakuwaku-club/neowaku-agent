import fs from 'fs/promises';
import path from 'path';
import { google } = require('googleapis');
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirnameの代替を作成（ESモジュールでは__dirnameが使えないため）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// クライアントシークレットJSONファイルのパス
const CREDENTIALS_PATH = path.join(process.env.HOME, 'Downloads', 'client_secret_601550015602-m234mjggdmusfl4uofcnl6ljp442fb4i.apps.googleusercontent.com.json');

// 認証情報を読み込む
const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
const { client_id, client_secret, redirect_uris } = credentials.installed;

// OAuth2クライアントを作成
const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// 必要なスコープを設定
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// 認証URLを生成
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // 毎回同意画面を表示し、リフレッシュトークンを確実に取得
});

console.log('以下のURLにアクセスして認証を行ってください:');
console.log(authUrl);

// ユーザーからの入力を受け付ける
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('認証後に表示されたコードを入力してください: ', async (code) => {
  try {
    // コードをトークンと交換
    const { tokens } = await oauth2Client.getToken(code);
    console.log('トークン情報:');
    console.log(tokens);
    
    // リフレッシュトークンを表示
    if (tokens.refresh_token) {
      console.log('\nリフレッシュトークン:');
      console.log(tokens.refresh_token);
      console.log('\n.envファイルに以下の行を追加してください:');
      console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
    } else {
      console.log('\n警告: リフレッシュトークンが取得できませんでした。');
      console.log('ブラウザのCookieをクリアして再試行するか、別のGoogleアカウントで試してください。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
  rl.close();
});
