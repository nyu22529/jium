// src/app/api/gemini-test/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // 1. .env.local 파일에서 우리만의 비밀 API 키를 안전하게 가져옵니다.
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

  try {
    // 2. 여러 Gemini 모델 중 'gemini-pro' 모델을 사용하도록 설정합니다.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // 3. Gemini에게 보낼 간단한 프롬프트를 작성합니다.
    const prompt = "Hello, World! 라는 문장을 주제로 짧은 시를 써줘.";

    // 4. 실제로 Gemini에게 프롬프트를 보내고 결과를 기다립니다.
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // 5. 성공적으로 받은 답변을 JSON 형태로 반환합니다.
    return NextResponse.json({ result: text });

  } catch (error) {
    // 6. 만약 API 키가 잘못되었거나 다른 에러가 발생하면, 에러 메시지를 반환합니다.
    console.error(error);
    return NextResponse.json({ error: "API 요청에 실패했습니다." }, { status: 500 });
  }
}