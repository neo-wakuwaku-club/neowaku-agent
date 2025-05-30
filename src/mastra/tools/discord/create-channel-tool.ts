import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, ChannelType, Guild, CategoryChannel } from "discord.js";

// Define the channel structure for the response
interface CreatedChannel {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  type: string;
}

export const createChannelTool = createTool({
  id: "create-channel",
  description: "Create a new Discord text channel in a specified guild/server",
  inputSchema: z.object({
    guildId: z.string().describe("Discord guild/server ID where the channel should be created"),
    channelName: z.string().describe("Name for the new channel"),
    category: z.string().optional().describe("Optional category ID or name to place the channel under"),
    topic: z.string().optional().describe("Optional channel topic/description"),
  }),
  outputSchema: z.object({
    channel: z.object({
      id: z.string(),
      name: z.string(),
      guildId: z.string(),
      guildName: z.string(),
      type: z.string(),
    }),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return await createChannel(
      context.guildId,
      context.channelName,
      context.category,
      context.topic
    );
  },
});

const createChannel = async (
  guildId: string,
  channelName: string,
  category?: string,
  topic?: string
) => {
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
    
    // Fetch the guild
    let guild: Guild;
    try {
      guild = await client.guilds.fetch(guildId);
    } catch (error) {
      client.destroy();
      throw new Error(`Guild with ID "${guildId}" not found or bot doesn't have access`);
    }
    
    // Create channel options
    const channelOptions: any = {
      name: channelName,
      type: ChannelType.GuildText,
    };
    
    // Add topic if provided
    if (topic) {
      channelOptions.topic = topic;
    }
    
    // Add parent category if provided
    if (category) {
      // Try to find the category by ID first
      try {
        const categoryChannel = await guild.channels.fetch(category);
        if (categoryChannel && categoryChannel.type === ChannelType.GuildCategory) {
          channelOptions.parent = category;
        }
      } catch (error) {
        // If not found by ID, try to find by name
        const guildChannels = await guild.channels.fetch();
        const categoryChannel = guildChannels.find(
          ch => ch !== null && 
               ch.type === ChannelType.GuildCategory && 
               ch.name.toLowerCase() === category.toLowerCase()
        );
        
        if (categoryChannel) {
          channelOptions.parent = categoryChannel.id;
        } else {
          // If category not found, log a warning but continue without category
          console.warn(`Category "${category}" not found in guild "${guild.name}"`);
        }
      }
    }
    
    // Create the channel
    const channel = await guild.channels.create(channelOptions);
    
    // Format the response
    const createdChannel: CreatedChannel = {
      id: channel.id,
      name: channel.name,
      guildId: guild.id,
      guildName: guild.name,
      type: 'text',
    };
    
    // Destroy the client connection
    client.destroy();
    
    // Prepare success message
    let successMessage = `Channel "${channelName}" successfully created in "${guild.name}"`;
    
    // Add category information if applicable
    if (channelOptions.parent) {
      try {
        const parentChannel = await guild.channels.fetch(channelOptions.parent);
        if (parentChannel) {
          successMessage += ` under category "${parentChannel.name}"`;
        }
      } catch (error) {
        // Ignore error if we can't fetch the parent channel name
      }
    }
    
    return {
      channel: createdChannel,
      success: true,
      message: successMessage,
    };
  } catch (error) {
    // Make sure to destroy the client even if there's an error
    client.destroy();
    
    // Return error information
    return {
      channel: {
        id: "",
        name: channelName,
        guildId: guildId,
        guildName: "",
        type: "text",
      },
      success: false,
      message: `Failed to create channel: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
