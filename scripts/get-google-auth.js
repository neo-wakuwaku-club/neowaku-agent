import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Create OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost'
);

// Generate authorization URL
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get authorization code from user
rl.question('認証コード: ', async (code) => {
  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n認証成功！');
    
    if (tokens.refresh_token) {
      console.log('\nリフレッシュトークン:');
      console.log(tokens.refresh_token);
      
      // Update .env file with refresh token
      const envPath = path.resolve(process.cwd(), '../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace refresh token line
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
