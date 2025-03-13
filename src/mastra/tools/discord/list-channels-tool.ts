import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, TextChannel, Guild, CategoryChannel } from "discord.js";

// Define the channel structure
interface DiscordChannel {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
}

// Define the category structure for tree output
interface CategoryNode {
  id: string;
  name: string;
  type: 'category';
  channels: DiscordChannel[];
}

// Define the tree structure for output
interface ChannelTree {
  categories: CategoryNode[];
  uncategorized: DiscordChannel[];
}

export const listChannelsTool = createTool({
  id: "list-channels",
  description: "List all available Discord text channels organized by categories in a tree structure",
  inputSchema: z.object({
    guildId: z.string().optional().describe("Optional Discord guild/server ID to filter channels"),
  }),
  outputSchema: z.object({
    channelTree: z.object({
      categories: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.literal('category'),
          channels: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              guildId: z.string(),
              guildName: z.string(),
              type: z.string(),
              parentId: z.string().nullable(),
              parentName: z.string().nullable(),
            })
          ),
        })
      ),
      uncategorized: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          guildId: z.string(),
          guildName: z.string(),
          type: z.string(),
          parentId: z.string().nullable(),
          parentName: z.string().nullable(),
        })
      ),
    }),
    // Keep the flat list for backward compatibility
    channels: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        guildId: z.string(),
        guildName: z.string(),
        type: z.string(),
        parentId: z.string().nullable(),
        parentName: z.string().nullable(),
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
    
    // Organize channels into a tree structure
    const channelTree = organizeChannelsIntoTree(channels);

    // Destroy the client connection
    client.destroy();
    
    return {
      channelTree,
      channels, // Keep the flat list for backward compatibility
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
      // Get parent category information if available
      const parentId = channel.parentId;
      let parentName = null;
      
      if (parentId) {
        const parent = guildChannels.get(parentId);
        if (parent && parent instanceof CategoryChannel) {
          parentName = parent.name;
        }
      }
      
      channels.push({
        id: channel.id,
        name: channel.name,
        guildId: guild.id,
        guildName: guild.name,
        type: 'text',
        parentId,
        parentName,
      });
    }
  });
};

// Helper function to organize channels into a tree structure
const organizeChannelsIntoTree = (channels: DiscordChannel[]): ChannelTree => {
  const categoryMap = new Map<string, CategoryNode>();
  const uncategorized: DiscordChannel[] = [];
  
  // First pass: identify all categories
  channels.forEach(channel => {
    if (channel.parentId && channel.parentName) {
      if (!categoryMap.has(channel.parentId)) {
        categoryMap.set(channel.parentId, {
          id: channel.parentId,
          name: channel.parentName,
          type: 'category',
          channels: [],
        });
      }
    }
  });
  
  // Second pass: assign channels to categories
  channels.forEach(channel => {
    if (channel.parentId && categoryMap.has(channel.parentId)) {
      categoryMap.get(channel.parentId)!.channels.push(channel);
    } else {
      uncategorized.push(channel);
    }
  });
  
  return {
    categories: Array.from(categoryMap.values()),
    uncategorized,
  };
};
