// notionAgent.ts
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { mcpConfiguration } from "../tools/mcp/mcpConfig";

// Memory の初期化（任意の設定に合わせて調整）
const memory = new Memory({
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
      template: "text-stream",
    },
  },
});

// トップレベル await を利用して MCP ツールを取得
const tools = await mcpConfiguration.getTools();

export const NotionAgent = new Agent({
  name: "MCP Agent",
  instructions: `
あなたはNotionアシスタントです。ユーザーの指示に従い、Notionのデータベースやページを操作します。以下のツールを使用して、タスクを実行してください。

notion page id : 1bc5f6ca76de800ab79ccc1451a2b736 
      `,
  model: openai("o4-mini-2025-04-16"),
  tools,
  memory,
});
