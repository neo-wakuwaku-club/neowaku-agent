import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { OpenAI } from "openai";
import crypto from "crypto";

// APIキー
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function generateRandomString(length: number = 10): string {
  return crypto.randomBytes(length).toString("hex");
}

// gpt-image-1で背景画像生成
async function generateBackgroundImageGptImage1(eventDetails: string, designInstructions: string = ""): Promise<Buffer> {
  const prompt = `
以下のイベント情報に基づいた、SNS投稿用の正方形フライヤーの背景画像を生成してください。  
背景画像にはテキストを一切含めず、後からシンプルでスタイリッシュなテキストを重ねるためのベースとして利用します。

デザインの要件は以下の通りです:
- モダンで洗練された印象を与える
- 落ち着いた雰囲気を保つ
- パステルカラーを中心とした配色で可愛い感じで
- 抽象的な形状やパターンを取り入れる
- SNS投稿用の正方形（例: 1024x1024）のフォーマットで作成
${designInstructions ? `\n【追加デザイン指示】\n${designInstructions}` : ''}

【イベント情報】  
    ${eventDetails}
  `;

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    quality: "high", // "standard" も可
    n: 1,
  });

  const b64 = response.data[0].b64_json;
  if (!b64) throw new Error("画像のbase64データが取得できませんでした。");
  return Buffer.from(b64, "base64");
}

// 背景画像保存
function saveBackgroundImage(imageBuffer: Buffer): string {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const randomId = generateRandomString();
  const filename = path.join(outputDir, `background_${randomId}.png`);
  fs.writeFileSync(filename, imageBuffer);
  return filename;
}

// メインフライヤー生成
async function generateFlyer(eventDetails: string, designInstructions: string = "") {
  const backgroundBuffer = await generateBackgroundImageGptImage1(eventDetails, designInstructions);
  const backgroundPath = saveBackgroundImage(backgroundBuffer);
  return {
    backgroundPath: path.resolve(backgroundPath),
  };
}

// createTool
export const flyerGeneratorTool = createTool({
  id: "generate-flyer-gpt-image-1",
  description: "gpt-image-1で背景画像のみを生成し、ファイルパスを返します。",
  inputSchema: z.object({
    eventDetails: z.string().describe("フライヤーに含めるイベント情報"),
    designInstructions: z.string().optional().describe("追加のデザイン指示"),
  }),
  outputSchema: z.object({
    backgroundPath: z.string(),
  }),
  execute: async ({ context }) => {
    const result = await generateFlyer(
      context.eventDetails,
      context.designInstructions || ""
    );
    return { backgroundPath: result.backgroundPath };
  },
});
