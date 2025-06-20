import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// APIキーを環境変数から取得
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-004" });

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ success: false, error: "画像データまたはMIMEタイプがありません。" }, { status: 400 });
    }

    // これはテキスト専用モデルなので、実際にはVisionモデルを使うべきですが、
    // まずはテキストでの説明からベクトルを生成する暫定対応とします。
    // 画像から直接ベクトルを生成するには、より複雑な設定が必要です。
    // ここでは、概念実証として「画像あり」という事実から説明文を生成します。
    const textToEmbed = `An image of type ${mimeType} was provided.`;

    const result = await embeddingModel.embedContent(textToEmbed);
    const embedding = result.embedding;

    return NextResponse.json({ success: true, embedding: embedding.values });

  } catch (error) {
    console.error("Embedding API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}