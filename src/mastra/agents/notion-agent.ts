import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { MCPConfiguration } from "@mastra/mcp";
import * as dotenv from 'dotenv';

dotenv.config();

const mcp = new MCPConfiguration({
  servers: {
    notion: {
      command: "node",
      args: ["/Users/USENAME/mcp-notion-server/notion/build/index.js"],
      env: {
        NOTION_API_TOKEN: process.env.NOTION_API_TOKEN,
      },
    },
    // ここに他のMCPサーバー設定を追加可能（例：Notion）
  },
});

export const NotionAgent = new Agent({
    name: "MCP Agent",
    instructions: `
あなたはNotionアシスタントです。ユーザーの指示に従い、Notionのデータベースやページを操作します。以下のツールを使用して、タスクを実行してください。

# ツール一覧

## createPage
新しいページを作成します。
パラメータ:
- title: ページのタイトル
- content: ページの内容

## updatePage
既存のページを更新します。
パラメータ:
- pageId: 更新するページのID
- content: 更新後の内容

## searchDatabase
データベース内を検索します。
パラメータ:
- query: 検索クエリ

# 使用例

ユーザー: 新しい会議の議事録ページを作成して
アシスタント:
<createPage>
  <title>会議の議事録</title>
  <content>会議の内容をここに記述します。</content>
</createPage>

ユーザー: 先週のタスク一覧を表示して
アシスタント:
<searchDatabase>
  <query>先週のタスク</query>
</searchDatabase>

    `,
    model: openai("gpt-4o"),
    tools: await mcp.getTools(),
});