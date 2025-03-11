import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weather";
import { discordContextAgent } from "./agents/discord-context";

import { flyerAgent } from "./agents/flyer";
 
export const mastra = new Mastra({
  agents: { weatherAgent, flyerAgent ,discordContextAgent },

import { discordContextAgent } from "./agents/discord-context";
});
