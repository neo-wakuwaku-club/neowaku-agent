import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { discordClient } from "../../discord";

/**
 * Tool for adding emoji reactions (stamps) to Discord messages
 */
export const addReactionTool = createTool({
  id: "add-reaction",
  description: "Discordメッセージに絵文字リアクション（スタンプ）を追加するツール",
  inputSchema: z.object({
    channelId: z.string().describe("リアクションを追加するメッセージのあるチャンネルID"),
    messageId: z.string().describe("リアクションを追加するメッセージID"),
    emoji: z.string().describe("追加するリアクション絵文字（Unicode絵文字、またはカスタム絵文字の場合は絵文字名:絵文字ID）"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const { channelId, messageId, emoji } = context;
      
      // Get the channel
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return {
          success: false,
          message: `チャンネルが見つからないか、テキストチャンネルではありません: ${channelId}`,
          error: `チャンネルが見つからないか、テキストチャンネルではありません: ${channelId}`
        };
      }

      // Get the message
      const message = await channel.messages.fetch(messageId);
      if (!message) {
        return {
          success: false,
          message: `メッセージが見つかりません: ${messageId}`,
          error: `メッセージが見つかりません: ${messageId}`
        };
      }

      // Add the reaction
      await message.react(emoji);

      return {
        success: true,
        message: `メッセージ ${messageId} に ${emoji} のリアクションを追加しました`
      };
    } catch (error) {
      console.error("Error adding reaction:", error);
      return {
        success: false,
        message: `リアクションの追加中にエラーが発生しました`,
        error: `リアクションの追加中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});
