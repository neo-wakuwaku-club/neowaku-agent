# Neowaku Agent

Neowaku Agentは、Mastraフレームワークを使用して構築された多機能TypeScriptアプリケーションで、AI機能をDiscordと統合し、イベントフライヤーを生成するためのツールを提供します。

## 機能

### Discordボット
- **天気情報**: Open-Meteo APIを使用して任意の場所のリアルタイム天気データを提供
- **Discordコンテキスト**: Discordチャンネルから会話を取得し要約
- **チャンネル一覧**: ボットがアクセスできるすべてのDiscordチャンネルを一覧表示

### フライヤージェネレーター
- **AI生成背景**: DALL-Eを使用してイベントフライヤー用の美しい背景画像を作成
- **テキストオーバーレイ**: Claudeを使用してイベント詳細を含むSVGテキストオーバーレイを生成
- **統合出力**: 背景とテキストオーバーレイを組み合わせてプロフェッショナルな印象のフライヤーを作成

## インストール

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/neo-wakuwaku-club/neowaku-agent.git
   cd neowaku-agent
   ```

2. 依存関係をインストール:
   ```bash
   npm install
   ```

3. 環境ファイルを作成:
   - 本番環境用に`.env`を作成
   - 開発環境用に`.env.development`を作成

## 設定

`.env`および/または`.env.development`ファイルに以下の変数を設定してください:

```
# Discordボット
DISCORD_TOKEN=your_discord_bot_token

# OpenAI (DALL-EとGPT-4o用)
OPENAI_API_KEY=your_openai_api_key

# Anthropic (Claude用)
CLAUDE_API_KEY=your_claude_api_key
```

## 使用方法

### 開発モード

開発モードでアプリケーションを実行:

```bash
npm run dev
```

### Discordボットコマンド

Discordボットはメンションとダイレクトメッセージに応答します。例えば:

- 天気を尋ねる: `@YourBot 東京の天気は？`
- チャンネルのコンテキストを取得: `@YourBot #generalの最近の会話を要約して`
- チャンネル一覧を表示: `@YourBot 利用可能なチャンネルを表示して`

### フライヤージェネレーター

フライヤージェネレーターは、AI生成の背景とテキストオーバーレイを使用してイベントフライヤーを作成します。出力には以下が含まれます:

1. DALL-Eで作成された背景画像
2. Claudeで作成されたSVGテキストオーバーレイ
3. 組み合わせたフライヤー画像

イベント詳細の例:

```
イベント: テックカンファレンス2025
日付: 2025年4月15日〜17日
場所: 東京国際フォーラム
スピーカー: 山田花子、鈴木太郎、佐藤次郎
説明: AI、ブロックチェーン、量子コンピューティングの最新情報をお届けします
```

## プロジェクト構造

```
neowaku-agent/
├── src/
│   └── mastra/
│       ├── index.ts           # メインアプリケーションのエントリーポイント
│       ├── discord.ts         # Discordボットの実装
│       ├── agents/            # Mastraエージェント
│       │   ├── weather.ts     # 天気情報エージェント
│       │   ├── flyer.ts       # フライヤー生成エージェント
│       │   └── discord-context.ts # Discordコンテキストエージェント
│       └── tools/             # エージェントが使用するツール
│           ├── weather-tool.ts # 天気APIツール
│           ├── discord/       # Discord関連ツール
│           │   ├── index.ts
│           │   ├── get-context-tool.ts
│           │   └── list-channels-tool.ts
│           └── flyer/         # フライヤー生成ツール
│               ├── index.ts
│               └── generator.ts
├── output/                    # 生成されたフライヤーの出力ディレクトリ
├── package.json
└── tsconfig.json
```

## 依存関係

- **Mastraフレームワーク**: エージェントベースのアプリケーション用のコアフレームワーク
- **AI SDK**: OpenAI (GPT-4o、DALL-E) および Anthropic (Claude)
- **Discord.js**: Discord統合
- **Sharp**: フライヤー生成のための画像処理
- **Express**: Webサーバー機能
- **TypeScript**: 型安全なJavaScript

## 技術的詳細

### Mastraエージェント

このプロジェクトは、Mastraフレームワークを使用して複数のAIエージェントを実装しています:

- **neoWakuエージェント**: メインのエージェントで、ユーザーのリクエストを処理し、適切なツールを呼び出します
- **weatherエージェント**: 天気情報を提供するエージェント
- **flyerエージェント**: フライヤー生成を担当するエージェント
- **discordContextエージェント**: Discordチャンネルからコンテキストを取得するエージェント

### フライヤー生成プロセス

フライヤー生成プロセスは以下のステップで行われます:

1. DALL-Eを使用してイベント情報に基づいた背景画像を生成
2. Claudeを使用してSVGテキストオーバーレイを生成
3. Sharpライブラリを使用して背景画像とSVGオーバーレイを組み合わせ
4. 生成されたフライヤーをoutputディレクトリに保存
5. オプションで、生成されたフライヤーをDiscordチャンネルに送信

### Discordインテグレーション

Discordボットは以下の機能を提供します:

- 指定されたチャンネルからメッセージを取得し、コンテキストを提供
- 利用可能なチャンネルの一覧を表示
- 生成されたフライヤーをDiscordチャンネルに直接送信

## 開発ガイド

### 新しいエージェントの追加

新しいエージェントを追加するには:

1. `src/mastra/agents/`ディレクトリに新しいエージェントファイルを作成
2. Mastraフレームワークを使用してエージェントを実装
3. `src/mastra/index.ts`ファイルでエージェントをインポートし、Mastraインスタンスに追加

### 新しいツールの追加

新しいツールを追加するには:

1. `src/mastra/tools/`ディレクトリに新しいツールファイルを作成
2. `createTool`関数を使用してツールを実装
3. 適切なエージェントでツールをインポートして使用

## トラブルシューティング

### APIキーの問題

- APIキーが正しく設定されていることを確認してください
- 各サービス（OpenAI、Anthropic、Discord）のAPIキーの有効性を確認してください

### Discordボットの接続問題

- Discordボットトークンが正しいことを確認してください
- ボットに必要な権限が付与されていることを確認してください
- Discordの開発者ポータルでボットの設定を確認してください

### フライヤー生成の問題

- 出力ディレクトリが存在し、書き込み権限があることを確認してください
- OpenAIとAnthropicのAPIキーが有効であることを確認してください
- SVG生成に問題がある場合は、生成されたSVGコードを確認してください

## ライセンス

ISC
