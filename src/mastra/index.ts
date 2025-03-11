import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weather";
import { discordContextAgent } from "./agents/discord-context";
 
export const mastra = new Mastra({
  agents: { weatherAgent, discordContextAgent },
});
