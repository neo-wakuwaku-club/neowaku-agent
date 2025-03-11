import { Client, Events, GatewayIntentBits, Message } from "discord.js";
import dotenv from "dotenv";
import { mastra } from "./index";
import { weatherAgent } from "./agents/weather";

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

  // Check if the message mentions the bot or is a direct message
  const isMentioned = client.user ? message.mentions.has(client.user.id) : false;
  const isDM = message.channel.isDMBased();

  if (isMentioned || isDM) {
    try {
      // Remove the bot mention from the message content if present
      let content = message.content;
      if (isMentioned && client.user) {
        content = content.replace(new RegExp(`<@!?${client.user.id}>`), "").trim();
      }

      // Indicate the bot is "typing" (if the method exists on this channel type)
      if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping();
      }

      // Get the user's ID for thread and resource identification
      const threadId = message.author.id;
      const resourceId = message.author.id;

      try {
        // Use the weatherAgent directly when mentioned, even without content
        const result = await weatherAgent.generate(content || "現在の天気は？", {
          threadId,
          resourceId,
        });
        
        // Send the response back to the channel
        await message.reply(result.text);
      } catch (error) {
        console.error("Weather agent processing error:", error);
        await message.reply("天気情報の取得中にエラーが発生しました。");
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
