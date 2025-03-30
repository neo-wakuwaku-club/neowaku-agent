// ESモジュール形式で実装
import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 環境変数を読み込む
dotenv.config();

// ディレクトリパスを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OAuth2クライアントを作成
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost'
);

// 認証URLを生成
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent'
});

console.log('認証URLを開いてください:');
console.log(authUrl);
console.log('\n認証後に表示されるコードをここに入力してください:');

// readlineインターフェースを作成
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ユーザーから認証コードを取得
rl.question('認証コード: ', async (code) => {
  try {
    // 認証コードをトークンと交換
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n認証成功！');
    
    if (tokens.refresh_token) {
      console.log('\nリフレッシュトークン:');
      console.log(tokens.refresh_token);
      
      // .envファイルをリフレッシュトークンで更新
      const envPath = path.resolve(__dirname, '../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // リフレッシュトークン行を置換
      envContent = envContent.replace(
        /GOOGLE_REFRESH_TOKEN=".*"/,
        `GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`
      );
      
      fs.writeFileSync(envPath, envContent);
      console.log('\n.envファイルにリフレッシュトークンを保存しました。');
    } else {
      console.log('\n警告: リフレッシュトークンが返されませんでした。');
      console.log('これは既に一度認証を行っている場合に発生することがあります。');
      console.log('Google Cloud Consoleで認証情報を削除して再試行するか、');
      console.log('別のクライアントIDを使用してください。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    rl.close();
  }
});
