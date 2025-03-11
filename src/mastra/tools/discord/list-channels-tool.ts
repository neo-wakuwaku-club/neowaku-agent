import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, TextChannel, Guild } from "discord.js";

// Define the channel structure
interface DiscordChannel {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  type: string;
}

export const listChannelsTool = createTool({
  id: "list-channels",
  description: "List all available Discord text channels the bot has access to",
  inputSchema: z.object({
    guildId: z.string().optional().describe("Optional Discord guild/server ID to filter channels"),
  }),
  outputSchema: z.object({
    channels: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        guildId: z.string(),
        guildName: z.string(),
        type: z.string(),
      })
    ),
  }),
  execute: async ({ context }) => {
    return await listChannels(context.guildId);
  },
});

const listChannels = async (guildId?: string) => {
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
    
    const channels: DiscordChannel[] = [];
    
    if (guildId) {
      // If a specific guild ID is provided, only fetch channels from that guild
      try {
        const guild = await client.guilds.fetch(guildId);
        await addChannelsFromGuild(guild, channels);
      } catch (error) {
        throw new Error(`Guild with ID "${guildId}" not found or bot doesn't have access`);
      }
    } else {
      // Otherwise, fetch channels from all guilds the bot has access to
      const guilds = await client.guilds.fetch();
      
      for (const guildId of guilds.keys()) {
        const guild = await client.guilds.fetch(guildId);
        await addChannelsFromGuild(guild, channels);
      }
    }
    
    // Destroy the client connection
    client.destroy();
    
    return {
      channels,
    };
  } catch (error) {
    // Make sure to destroy the client even if there's an error
    client.destroy();
    throw error;
  }
};

// Helper function to add channels from a guild to the channels array
const addChannelsFromGuild = async (guild: Guild, channels: DiscordChannel[]) => {
  const guildChannels = await guild.channels.fetch();
  
  guildChannels.forEach(channel => {
    if (channel instanceof TextChannel) {
      channels.push({
        id: channel.id,
        name: channel.name,
        guildId: guild.id,
        guildName: guild.name,
        type: 'text',
      });
    }
  });
};
