import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weather";
import { flyerAgent } from "./agents/flyer";
 
export const mastra = new Mastra({
  agents: { weatherAgent, flyerAgent },
});
