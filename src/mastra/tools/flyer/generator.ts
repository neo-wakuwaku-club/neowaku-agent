import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from 'fs';
import path from 'path';
import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import { exec } from 'child_process';
import sharp from 'sharp';
import 'dotenv/config';

// Define types
interface EventDetails {
  content: string;
}

interface GeneratedFlyer {
  backgroundPath: string;
  svgPath: string;
  combinedPath: string | null;
}

// API keys retrieved from .env
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize API clients
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY || '',
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || '',
});

/**
 * Generate background image using DALL-E
 * @param eventDetails - Event details to base the background on
 * @param designInstructions - Additional design instructions or preferences
 * @returns Image buffer
 */
async function generateBackgroundImage(eventDetails: string, designInstructions: string = ""): Promise<Buffer> {
  console.log("DALL-Eを使用して背景画像を生成中...");
  
  // Create a prompt for DALL-E that describes the desired background
  const prompt = `
以下のイベント情報に基づいた、SNS投稿用の正方形フライヤーの背景画像を生成してください。  
背景画像にはテキストを一切含めず、後からシンプルでスタイリッシュなSVGテキストを重ねるためのベースとして利用します。

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

  // Generate image with DALL-E
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    size: "1024x1024",
    quality: "standard",
    n: 1,
  });

  // Get image URL from response
  const imageUrl = response.data[0].url;
  
  if (!imageUrl) {
    throw new Error("Failed to generate image with DALL-E");
  }
  
  // Download the image
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  
  return Buffer.from(imageBuffer);
}

/**
 * Generate SVG text overlay using Claude
 * @param eventDetails - Event details to include in the flyer
 * @param designInstructions - Additional design instructions or preferences
 * @returns SVG content
 */
async function generateSvgTextOverlay(eventDetails: string, designInstructions: string = ""): Promise<string> {
  console.log("Claudeを使用してSVGテキストオーバーレイを生成中...");
  
  const prompt = `
    あなたはSVGのエキスパートです。以下のイベント情報を元に、シンプルでスタイリッシュなSVGテキストオーバーレイを作成してください。
    このSVGは背景画像の上に重ねられるため、背景は透明にしてください。

    # イベント情報
    ${eventDetails}

    # デザイン要件
    - SNS投稿用の正方形フォーマット（1080px x 1080px）で作成してください。
    - 背景は白の透明にし、テキストと最小限の装飾要素のみを含めてください。
    - モダンでミニマリストなデザインを心がけてください。
    - 洗練された美しいタイポグラフィを使用し、フォントの種類は最大でも2種類に抑えてください。
    - 余白を十分に取り、すっきりとした印象を与えてください。
    - 重要な情報（イベント名、日時、場所）は大きく、その他の情報は控えめに配置してください。
    - テキストの可読性を高めるため、必要に応じて半透明の背景パネルを使用してください（ただし最小限に）。
    - 日本語テキストが正しく表示されるように、日本語フォントを指定してください（例：'Noto Sans JP', 'Hiragino Sans', 'Meiryo', sans-serif）。
    - 外部リソースは使用せず、すべてのスタイルはインラインで記述してください。
    - 完全なSVGファイルを作成してください。SVGタグから始まり、必要なすべての要素を含めてください。
    - SVGファイルには必ず <?xml version="1.0" encoding="UTF-8" standalone="no"?> の宣言を含めてください。
    - 装飾的な要素は最小限に抑え、情報の明確さを優先してください。
    - 全体的に洗練された印象を与える、現代的でスタイリッシュなデザインを目指してください。
    - 文字の下には半透明のカバーをかけてみやすくして
    - 人数が多い時は、二列にしてみやすく表示して
    ${designInstructions ? `\n# 追加デザイン指示\n${designInstructions}` : ''}
  

    SVGコードのみを返してください。説明は不要です。
  `;

  // Call Claude API
  const response = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 4000,
    temperature: 0.7,
    system: "あなたはSVGのエキスパートです。与えられた情報から透明背景のSVGテキストオーバーレイを作成します。",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });
  
  // Extract SVG content from response
  let svgContent = '';
  
  // Handle different content block types
  if (response.content[0].type === 'text') {
    svgContent = response.content[0].text;
  } else if (response.content[0].type === 'tool_use') {
    // Handle tool use block if needed
    console.log("Received tool_use block instead of text");
    svgContent = JSON.stringify(response.content[0]);
  } else {
    // Fallback for other content types
    svgContent = JSON.stringify(response.content[0]);
  }
  
  // Clean up the response if it contains markdown code blocks
  if (svgContent.includes("```svg")) {
    svgContent = svgContent.split("```svg")[1].split("```")[0].trim();
  } else if (svgContent.includes("```xml")) {
    svgContent = svgContent.split("```xml")[1].split("```")[0].trim();
  } else if (svgContent.includes("```")) {
    svgContent = svgContent.split("```")[1].split("```")[0].trim();
  }
  
  return svgContent;
}

/**
 * Save background image to a file
 * @param imageBuffer - Image buffer to save
 * @returns Path to the saved file
 */
function saveBackgroundImage(imageBuffer: Buffer): string {
  // Create output directory if it doesn't exist
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15);
  const filename = path.join(outputDir, `background_${timestamp}.png`);
  
  // Write image buffer to file
  fs.writeFileSync(filename, imageBuffer);
  
  return filename;
}

/**
 * Save SVG content to a file
 * @param svgContent - SVG content to save
 * @returns Path to the saved file
 */
function saveSvgFile(svgContent: string): string {
  // Create output directory if it doesn't exist
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15);
  const filename = path.join(outputDir, `overlay_${timestamp}.svg`);
  
  // Add XML declaration if not present
  if (!svgContent.startsWith('<?xml')) {
    svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgContent;
  }
  
  // Ensure Japanese fonts are specified
  if (svgContent.includes('font-family="') && !svgContent.includes('Hiragino')) {
    svgContent = svgContent.replace(
      'font-family="Arial, sans-serif"', 
      'font-family="\'Hiragino Sans\', \'Meiryo\', \'MS PGothic\', Arial, sans-serif"'
    );
  }
  
  // Write SVG content to file
  fs.writeFileSync(filename, svgContent, { encoding: "utf-8" });
  
  return filename;
}

/**
 * Combine background image and SVG overlay
 * @param backgroundPath - Path to the background image
 * @param svgPath - Path to the SVG overlay
 * @returns Path to the combined image
 */
async function combineBackgroundAndSvg(backgroundPath: string, svgPath: string): Promise<string | null> {
  // Create output directory if it doesn't exist
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate output filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15);
  const outputFilename = path.join(outputDir, `flyer_${timestamp}_combined.png`);
  
  try {
    // Get background image dimensions
    const backgroundMetadata = await sharp(backgroundPath).metadata();
    const width = backgroundMetadata.width || 1024;
    const height = backgroundMetadata.height || 1024;
    
    // Read SVG file
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    
    // Convert SVG to PNG buffer with transparency, matching background dimensions
    const svgBuffer = await sharp(Buffer.from(svgContent))
      .resize(width, height)
      .png()
      .toBuffer();
    
    // Composite the SVG on top of the background image
    await sharp(backgroundPath)
      .composite([
        {
          input: svgBuffer,
          gravity: 'center'
        }
      ])
      .toFile(outputFilename);
    
    console.log(`\n合成画像が生成されました: ${outputFilename}`);
    console.log(`ファイルパス: ${path.relative(process.cwd(), outputFilename)}`);
    return outputFilename;
  } catch (error) {
    console.error("画像合成中にエラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    return null;
  }
}

/**
 * Generate a flyer with DALL-E background and SVG text overlay
 * @param eventDetails - Event details to include in the flyer
 * @param designInstructions - Additional design instructions or preferences
 * @returns Paths to the generated files
 */
async function generateFlyer(eventDetails: string, designInstructions: string = ""): Promise<GeneratedFlyer> {
  try {
    // Generate background image with DALL-E
    console.log("\nDALL-Eを使用して背景画像を生成中...\n");
    const backgroundBuffer = await generateBackgroundImage(eventDetails, designInstructions);
    const backgroundPath = saveBackgroundImage(backgroundBuffer);
    console.log(`背景画像が生成されました: ${backgroundPath}`);
    console.log(`ファイルパス: ${path.relative(process.cwd(), backgroundPath)}`);
    
    // Generate SVG text overlay with Claude
    console.log("\nClaudeを使用してSVGテキストオーバーレイを生成中...\n");
    const svgContent = await generateSvgTextOverlay(eventDetails, designInstructions);
    const svgPath = saveSvgFile(svgContent);
    console.log(`SVGテキストオーバーレイが生成されました: ${svgPath}`);
    console.log(`ファイルパス: ${path.relative(process.cwd(), svgPath)}`);
    
    // Combine background and SVG overlay
    console.log("\n背景画像とSVGテキストを合成中...\n");
    const combinedPath = await combineBackgroundAndSvg(backgroundPath, svgPath);
    
    // Display generated files
    console.log("\n生成されたファイル:");
    const relativeBackgroundPath = path.relative(process.cwd(), backgroundPath);
    const relativeSvgPath = path.relative(process.cwd(), svgPath);
    const relativeCombinedPath = combinedPath ? path.relative(process.cwd(), combinedPath) : null;
    
    console.log(`1. 背景画像: ${relativeBackgroundPath}`);
    console.log(`2. SVGテキストオーバーレイ: ${relativeSvgPath}`);
    if (relativeCombinedPath) {
      console.log(`3. 合成フライヤー: ${relativeCombinedPath}`);
    }
    
    return {
      backgroundPath: relativeBackgroundPath,
      svgPath: relativeSvgPath,
      combinedPath: relativeCombinedPath
    };
  } catch (error) {
    console.error("エラーが発生しました:", error);
    throw error;
  }
}

/**
 * Send image to Discord
 * @param imagePath - Path to the image to send
 * @param messageContext - Discord message context
 * @returns Whether the image was sent successfully
 */
async function sendImageToDiscord(imagePath: string, messageContext: any): Promise<boolean> {
  try {
    // Import discord.js types and client
    const { discordClient } = await import('../../discord');
    const { ChannelType } = await import('discord.js');
    
    // Get the channel
    const channel = await discordClient.channels.fetch(messageContext.channelId);
    
    if (!channel) {
      console.error("Discord画像送信失敗: チャンネルが見つかりません");
      return false;
    }
    
    // Check if it's a text channel
    if (channel.type === ChannelType.GuildText || 
        channel.type === ChannelType.DM || 
        channel.type === ChannelType.PublicThread || 
        channel.type === ChannelType.PrivateThread) {
      
      // Use the appropriate method based on channel type
      // @ts-ignore - We've already checked the channel type
      await channel.send({
        files: [{
          attachment: imagePath,
          name: path.basename(imagePath)
        }]
      });
      
      console.log(`Discord画像送信成功: ${imagePath}`);
      return true;
    }
    
    console.error(`Discord画像送信失敗: サポートされていないチャンネルタイプ: ${channel.type}`);
    return false;
  } catch (error) {
    console.error("Discord画像送信中にエラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    return false;
  }
}

// Create the flyer generator tool
export const flyerGeneratorTool = createTool({
  id: "generate-flyer",
  description: "Generate a flyer with DALL-E background image and SVG text overlay",
  inputSchema: z.object({
    eventDetails: z.string().describe("Event details to include in the flyer"),
    designInstructions: z.string().optional().describe("Additional design instructions or preferences for the flyer"),
    discordMessageContext: z.object({
      messageId: z.string(),
      channelId: z.string()
    }).optional().describe("Discord message context for sending the flyer back"),
  }),
  outputSchema: z.object({
    backgroundPath: z.string(),
    svgPath: z.string(),
    combinedPath: z.string().nullable(),
    sentToDiscord: z.boolean().optional(),
  }),
  execute: async ({ context }) => {
    const result = await generateFlyer(
      context.eventDetails, 
      context.designInstructions || ""
    );
    
    let sentToDiscord = false;
    
    // Send to Discord if context is provided and combined image exists
    if (context.discordMessageContext && result.combinedPath) {
      console.log(`Sending flyer to Discord channel: ${context.discordMessageContext.channelId}`);
      sentToDiscord = await sendImageToDiscord(result.combinedPath, context.discordMessageContext);
    } else {
      console.log(`No Discord message context provided or no combined image path`);
    }
    
    return {
      ...result,
      sentToDiscord
    };
  },
});
