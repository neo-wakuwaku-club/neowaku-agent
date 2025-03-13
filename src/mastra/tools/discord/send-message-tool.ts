import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client, GatewayIntentBits, TextChannel, AttachmentBuilder } from "discord.js";
import fs from "fs";
import path from "path";

// Define the message response structure
interface MessageResponse {
  channelId: string;
  channelName: string;
  guildId: string;
  guildName: string;
  messageId: string;
  content: string;
  imageAttached: boolean;
}

export const sendMessageTool = createTool({
  id: "send-message",
  description: "Send a message and optionally an image to a specific Discord channel",
  inputSchema: z.object({
    channelId: z.string().describe("ID of the Discord channel to send the message to"),
    message: z.string().describe("The message content to send"),
    imagePath: z.string().optional().describe("Optional path to an image file to attach to the message"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    response: z.object({
      channelId: z.string(),
      channelName: z.string(),
      guildId: z.string(),
      guildName: z.string(),
      messageId: z.string(),
      content: z.string(),
      imageAttached: z.boolean(),
    }).optional(),
  }),
  execute: async ({ context }) => {
    return await sendMessage(context.channelId, context.message, context.imagePath);
  },
});

const sendMessage = async (channelId: string, message: string, imagePath?: string) => {
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
    
    // Fetch the channel
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error(`Channel with ID "${channelId}" not found or bot doesn't have access`);
    }
    
    if (!(channel instanceof TextChannel)) {
      throw new Error(`Channel with ID "${channelId}" is not a text channel`);
    }

    let sentMessage;
    let imageAttached = false;

    // Check if an image path was provided and if the file exists
    if (imagePath) {
      try {
        // Check if the file exists and is readable
        await fs.promises.access(imagePath, fs.constants.R_OK);
        
        // Create an attachment from the file
        const attachment = new AttachmentBuilder(imagePath, {
          name: path.basename(imagePath)
        });
        
        // Send the message with the attachment
        sentMessage = await channel.send({
          content: message,
          files: [attachment]
        });
        
        imageAttached = true;
      } catch (error) {
        // If there's an error with the image, just send the text message
        console.error(`Error attaching image: ${error instanceof Error ? error.message : String(error)}`);
        sentMessage = await channel.send(message);
      }
    } else {
      // Send just the text message
      sentMessage = await channel.send(message);
    }
    
    // Format the response
    const response: MessageResponse = {
      channelId: channel.id,
      channelName: channel.name,
      guildId: channel.guild.id,
      guildName: channel.guild.name,
      messageId: sentMessage.id,
      content: message,
      imageAttached
    };
    
    return {
      success: true,
      message: `Successfully sent message to channel "${channel.name}" in "${channel.guild.name}"`,
      response
    };
  } catch (error) {
    // Return error information
    return {
      success: false,
      message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    // Always destroy the client when done
    client.destroy();
  }
};
