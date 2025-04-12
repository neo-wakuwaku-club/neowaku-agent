// mcpConfig.ts
import { MCPConfiguration } from "@mastra/mcp";
import * as dotenv from "dotenv";

dotenv.config();

// Optional: Add a check to ensure the token is available
if (!process.env.NOTION_API_TOKEN) {
  throw new Error("Please set the NOTION_API_TOKEN in your .env file");
}

export const mcpConfiguration = new MCPConfiguration({
  servers: {
    // Notion 用 MCP サーバーの設定
    notion: {
      command: "npx",
      args: ["@suekou/mcp-notion-server"],
      env: {
        NOTION_API_TOKEN: process.env.NOTION_API_TOKEN,
      },
    },
  }, // 他の MCP サーバー設定があればここに追加可能
});
