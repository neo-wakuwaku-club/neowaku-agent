import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

// Define the message structure
interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    bot: boolean;
  };
  timestamp: string;
}

export const getContextTool = createTool({
  id: "get-context",
  description: "Get the latest 40 messages from a Discord channel、チャンネル名がよくわからない時はチャンネル一覧を確認して一番近いものを選んで",
  inputSchema: z.object({
    channel: z.string().describe("Discord channel name or ID to fetch messages from"),
  }),
  outputSchema: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        author: z.object({
          id: z.string(),
          username: z.string(),
          bot: z.boolean(),
        }),
        timestamp: z.string(),
      })
    ),
  }),
  execute: async ({ context }) => {
    return await getChannelMessages(context.channel);
  },
});

const getChannelMessages = async (channelNameOrId: string) => {
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
      GatewayIntentBits.MessageContent,
    ],
  });

  try {
    // Login to Discord
    await client.login(token);
    
    let targetChannel: TextChannel | null = null;
    
    // Check if the input is a channel ID (snowflake)
    const isChannelId = /^\d{17,19}$/.test(channelNameOrId);
    
    if (isChannelId) {
      // Fetch the channel directly by ID
      const channel = await client.channels.fetch(channelNameOrId);
      if (channel instanceof TextChannel) {
        targetChannel = channel;
      }
    } else {
      // Search for the channel by name across all guilds
      const guilds = await client.guilds.fetch();
      
      for (const guildId of guilds.keys()) {
        const guild = await client.guilds.fetch(guildId);
        const channels = await guild.channels.fetch();
        
        const foundChannel = channels.find(
          (ch) => 
            ch instanceof TextChannel && 
            (ch.name.toLowerCase() === channelNameOrId.toLowerCase() || 
             ch.name.toLowerCase().includes(channelNameOrId.toLowerCase()))
        );
        
        if (foundChannel instanceof TextChannel) {
          targetChannel = foundChannel;
          break;
        }
      }
    }
    
    if (!targetChannel) {
      throw new Error(`Channel "${channelNameOrId}" not found or is not a text channel`);
    }
    
    // Fetch the latest 40 messages
    const messages = await targetChannel.messages.fetch({ limit: 40 });
    
    // Transform messages to the expected format
    const formattedMessages: DiscordMessage[] = messages.map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        bot: msg.author.bot,
      },
      timestamp: msg.createdAt.toISOString(),
    }));
    
    // Destroy the client connection
    client.destroy();
    
    return {
      messages: formattedMessages,
    };
  } catch (error) {
    // エラーが発生しても必ずクライアント接続を閉じる
    client.destroy();
    throw error;
  }
  };