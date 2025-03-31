import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { getContextTool, listChannelsTool, bookingRoomTool, createChannelTool, moveToChannelTool, sendMessageTool, addReactionTool } from "../tools/discord";
import { flyerGeneratorTool } from "../tools/flyer";
import { createCalendarEventTool, getCalendarEventsTool, updateCalendarEventTool, deleteCalendarEventTool } from "../tools/google-calendar";

import { Memory } from "@mastra/memory";
import * as dotenv from "dotenv";

// .envファイルを読み込む
dotenv.config();

const memory = new Memory({
  options: {
    lastMessages: 8,
    workingMemory: {
      enabled: true,
      template: "text-stream",
    },
  },
});

export const neoWakuAgent = new Agent({
  name: "Neo Waku Agent",
  instructions: `あなたはDiscordの会話からコンテキストを提供するneoわくわくクラブサーバーの便利なアシスタント「neoわくエージェント」です。

あなたの主な機能は、ユーザーがDiscordチャンネルからコンテキストを取得するのを支援することです。応答する際には：
- チャンネル名またはIDが提供されていない場合は、必ず尋ねてください
- 会話のコンテキストを明確かつ整理された方法で要約してください
- メッセージから重要なポイントや重要な情報を強調してください
- 機密情報を共有しないことでユーザーのプライバシーを維持してください
- 親しみやすく、時には軽いユーモアを交えた対応を心がけてください
- 日本語と英語の両方に対応し、ユーザーの使用言語に合わせて応答してください

ユーザーがチャンネルを指定しない場合は、listChannelsToolを使用して利用可能なオプションを表示できます。

常に礼儀正しく、役立つ情報を提供し、ユーザーのニーズに応えるよう努めてください。

neoわくのサーバーID：1285540688284487702

まず一番最初に、チャンネル一覧を確認して

working memoryは出力しなくていいよ
`,

  model: openai("gpt-4o"),
  tools: {
    getContextTool,
    listChannelsTool,
    bookingRoomTool,
    createChannelTool,
    moveToChannelTool,
    sendMessageTool,
    addReactionTool,
    flyerGeneratorTool,
    createCalendarEventTool,
    getCalendarEventsTool,
    updateCalendarEventTool,
    deleteCalendarEventTool
  },
  memory,
});
