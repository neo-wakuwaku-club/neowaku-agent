// ESモジュール形式で実装
import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// 認証コード（URLからcode=の後ろの部分）
const authCode = '4/0AQSTgQHkUN0Opb3-nWvxF5EXydgRVJErpK7o8ulsPjs-9DWjs4U041_7DFRJL4Iw-DrY9A';

// OAuth2クライアントを作成
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost'
);

async function getToken() {
  try {
    // 認証コードをトークンと交換
    const { tokens } = await oauth2Client.getToken(authCode);
    console.log('\n認証成功！');
    
    if (tokens.refresh_token) {
      console.log('\nリフレッシュトークン:');
      console.log(tokens.refresh_token);
      console.log('\nこのトークンを.envファイルのGOOGLE_REFRESH_TOKENに設定してください。');
    } else {
      console.log('\n警告: リフレッシュトークンが返されませんでした。');
      console.log('これは既に一度認証を行っている場合に発生することがあります。');
      console.log('Google Cloud Consoleで認証情報を削除して再試行するか、');
      console.log('別のクライアントIDを使用してください。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

getToken();
