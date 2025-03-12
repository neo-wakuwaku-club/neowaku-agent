import { Client, Events, GatewayIntentBits, Message } from "discord.js";
import dotenv from "dotenv";
import { mastra } from "./index";
import { neoWakuAgent } from "./agents/neowaku-agent";

// Load environment variables
dotenv.config();

// Create a new Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Handle ready event
client.once(Events.ClientReady, (readyClient: Client) => {
  if (readyClient.user) {
    console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
  } else {
    console.log(`Discord bot ready!`);
  }
});

// Handle message creation event
client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore messages from bots to prevent potential loops
  if (message.author.bot) return;

  // Get the allowed channel IDs from environment variables (comma-separated list)
  const allowedChannelIdsStr = process.env.ALLOWED_CHANNELS || process.env.TEST_CHANNEL || '';
  const allowedChannelIds = allowedChannelIdsStr.split(',').map(id => id.trim()).filter(id => id);
  
  // Check if the message is in one of the allowed channels or is a direct message
  const isAllowedChannel = message.channel.isTextBased() && 
                          !message.channel.isDMBased() && 
                          allowedChannelIds.includes(message.channelId);
  const isDM = message.channel.isDMBased();
  console.log(`Channel ${message.channelId} allowed: ${isAllowedChannel}`);

  if (isAllowedChannel || isDM) {
    try {
      // Use the message content directly
      let content = message.content;

      // Indicate the bot is "typing" (if the method exists on this channel type)
      if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping();
      }

      // Get the channel ID and user ID for thread and resource identification
      const threadId = "user_"+message.channelId; // Use channel ID for threadId
      const resourceId = message.author.id; // Use user ID for resourceId
      console.log(`thread ${threadId}, resource ${resourceId}`);

      try {
        // Create a message with Discord context information
        const messageWithContext = `${content}`;
        
        // Use the neoWakuAgent directly
        const result = await neoWakuAgent.generate(messageWithContext, {
          threadId,
          resourceId
        });
        
        // Send the response back to the channel
        await message.reply(result.text);
      } catch (error) {
        console.error("Neo Waku agent processing error:", error);
        await message.reply("処理中にエラーが発生しました。");
      }
    } catch (error) {
      console.error("Error processing message:", error);
      await message.reply("Sorry, I encountered an error while processing your request.");
    }
  }
});

// Login to Discord with the token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("DISCORD_TOKEN is not set in environment variables");
}

// Function to start the Discord bot
export const startDiscordBot = async () => {
  try {
    await client.login(token);
    console.log("Discord bot is starting up...");
  } catch (error) {
    console.error("Failed to start Discord bot:", error);
    throw error;
  }
};

// Export the client for use in other parts of the application
export const discordClient = client;

// Start the Discord bot when this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startDiscordBot().catch(console.error);
}
