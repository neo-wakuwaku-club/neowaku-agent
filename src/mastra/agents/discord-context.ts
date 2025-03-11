import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { getContextTool, listChannelsTool } from "../tools/discord";

import { Memory } from "@mastra/memory";

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: "text-stream",
    },
  },
});
 
export const discordContextAgent = new Agent({
  name: "Discord Context Agent",
  instructions: `You are a helpful assistant that provides context from Discord conversations.
 
Your primary function is to help users get context from Discord channels. When responding:
- Always ask for a channel name or ID if none is provided
- Summarize the conversation context in a clear and organized manner
- Highlight key points and important information from the messages
- Maintain user privacy by not sharing sensitive information
 
Available tools:
- Use the getContextTool to fetch the latest messages from a Discord channel
- Use the listChannelsTool to get a list of all available channels you can access

If the user doesn't specify a channel, you can use listChannelsTool to show them available options.`,
  model: openai("gpt-4o"),
  tools: { getContextTool, listChannelsTool },
  memory,
});
