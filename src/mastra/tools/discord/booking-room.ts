import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

export const bookingRoomTool = createTool({
  id: "booking-room",
  description: "部屋の名前を元に特定のチャンネルに施設利用届を出して欲しい旨を伝えるメッセージを投稿する",
  inputSchema: z.object({
    roomName: z.string().describe("予約したい部屋の名前"),
    additionalInfo: z.string().optional().describe("追加情報（オプション）"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    channelName: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    return await bookRoom(context.roomName, context.additionalInfo);
  },
});

const bookRoom = async (roomName: string, additionalInfo?: string) => {
  // Get Discord token from environment variables
  const token = process.env.DISCORD_TOKEN;
  
  if (!token) {
    throw new Error("DISCORD_TOKEN is not set in environment variables");
  }

  // Create a new Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  try {
    // Login to Discord
    await client.login(token);
    
    // Find the appropriate channel based on the room name
    // This could be a mapping of room names to channel IDs or a naming convention
    let targetChannel: TextChannel | null = null;
    let channelName = "施設利用申請";
    
    // Search for the appropriate channel across all guilds
    const guilds = await client.guilds.fetch();
    
    for (const guildId of guilds.keys()) {
      const guild = await client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();
      
      // Look for channels that might be related to facility booking or the specific room
      // This is a simple example - you might want to customize this logic based on your Discord server structure
      const facilityChannels = channels.filter(
        (ch) => 
          ch instanceof TextChannel && 
          (ch.name.toLowerCase().includes('facility') || 
           ch.name.toLowerCase().includes('booking') ||
           ch.name.toLowerCase().includes('予約') ||
           ch.name.toLowerCase().includes('施設') ||
           ch.name.toLowerCase().includes(roomName.toLowerCase()))
      );
      
      if (facilityChannels.size > 0) {
        // Use the first matching channel
        const channel = facilityChannels.first();
        if (channel instanceof TextChannel) {
          targetChannel = channel;
          channelName = channel.name;
          break;
        }
      }
    }
    
    if (!targetChannel) {
      // Destroy the client connection
      client.destroy();
      return {
        success: false,
        error: `適切なチャンネルが見つかりませんでした。部屋名: ${roomName}`,
      };
    }
    
    // Construct the message
    let message = `<@726024853647523850> ${roomName}の施設利用届を出していただけますか？`;
    
    // Add additional information if provided
    if (additionalInfo) {
      message += `\n\n追加情報: ${additionalInfo}`;
    }
    
    // Send the message
    const sentMessage = await targetChannel.send(message);
    
    // Destroy the client connection
    client.destroy();
    
    return {
      success: true,
      messageId: sentMessage.id,
      channelName: channelName,
    };
  } catch (error) {
    // Make sure to destroy the client even if there's an error
    client.destroy();
    
    return {
      success: false,
      error: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
