// mcpConfig.ts
import { MCPConfiguration } from "@mastra/mcp";
import * as dotenv from "dotenv";

dotenv.config();

// 環境変数から認証情報を取得
const notionHeaders = {
  Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
  "Notion-Version": "2022-06-28",
};

export const mcpConfiguration = new MCPConfiguration({
  servers: {
    // Notion 用 MCP サーバーの設定
    notionApi: {
      command: "pnpx",
      args: ["@notionhq/notion-mcp-server"],
      env: {
        // ヘッダー情報は JSON 文字列として渡す
        OPENAPI_MCP_HEADERS: JSON.stringify(notionHeaders),
      },
    },
    // 他の MCP サーバー設定があればここに追加可能
  },
});
