import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, TextChannel, ChannelType, CategoryChannel } from "discord.js";

// Define the channel structure for the response
interface ChannelInfo {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  type: string;
}

export const moveToChannelTool = createTool({
  id: "move-to-channel",
  description: "Move a Discord text channel to a different category",
  inputSchema: z.object({
    channelId: z.string().describe("ID of the Discord channel to move"),
    category: z.string().describe("ID or name of the category to move the channel to"),
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
    return await moveToChannel(context.channelId, context.category);
  },
});

const moveToChannel = async (channelId: string, category: string) => {
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
  
  // Login to Discord
  await client.login(token);

  try {
    // Fetch the channel
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error(`Channel with ID "${channelId}" not found or bot doesn't have access`);
    }
    
    if (!(channel instanceof TextChannel)) {
      throw new Error(`Channel with ID "${channelId}" is not a text channel`);
    }
    
    // Find the category to move the channel to
    let categoryChannel;
    let categoryName = "";
    
    // Try to find the category by ID first
    try {
      categoryChannel = await channel.guild.channels.fetch(category);
      if (categoryChannel && categoryChannel.type === ChannelType.GuildCategory) {
        categoryName = categoryChannel.name;
      } else {
        categoryChannel = null;
      }
    } catch (error) {
      // If not found by ID, try to find by name
      const guildChannels = await channel.guild.channels.fetch();
      categoryChannel = guildChannels.find(
        ch => ch !== null && 
             ch.type === ChannelType.GuildCategory && 
             ch.name.toLowerCase() === category.toLowerCase()
      );
      
      if (categoryChannel) {
        categoryName = categoryChannel.name;
      }
    }
    
    if (!categoryChannel) {
      throw new Error(`Category "${category}" not found in guild "${channel.guild.name}"`);
    }
    
    // Move the channel to the category
    await channel.setParent(categoryChannel.id);
    
    // Send a message to the channel to confirm the move
    await channel.send(`This channel has been moved to the "${categoryName}" category.`);
    
    // Format the response
    const channelInfo: ChannelInfo = {
      id: channel.id,
      name: channel.name,
      guildId: channel.guild.id,
      guildName: channel.guild.name,
      type: 'text',
    };
    
    // Always destroy the client when done
    client.destroy();
    
    return {
      channel: channelInfo,
      success: true,
      message: `Successfully moved channel "${channel.name}" to category "${categoryName}" in "${channel.guild.name}"`,
    };
  } catch (error) {
    // Always destroy the client when done
    client.destroy();
    
    // Return error information
    return {
      channel: {
        id: channelId,
        name: "",
        guildId: "",
        guildName: "",
        type: "text",
      },
      success: false,
      message: `Failed to move channel: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
