import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Agent } from 'undici';

// --- 백엔드 설정 ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  agent: new Agent({
    pipelining: 1,
    keepAliveTimeout: 10000,
    keepAliveMaxTimeout: 10000,
  }),
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// --- 유효성 검사 규칙 ---
const blogPromptSchema = z.object({
  templateType: z.literal('blog'),
  inputs: z.object({
    topic: z.string().min(2, { message: "주제는 2글자 이상 입력해주세요." }),
    targetAudience: z.string().min(2, { message: "대상 독자는 2글자 이상 입력해주세요." }),
    tone: z.string().min(2, { message: "톤앤매너는 2글자 이상 입력해주세요." }),
    constraints: z.string().optional(),
  }),
});

const emailPromptSchema = z.object({
  templateType: z.literal('email'),
  inputs: z.object({
    recipient: z.string().min(2, { message: "받는 사람은 2글자 이상 입력해주세요." }),
    purpose: z.string().min(2, { message: "핵심 용건은 2글자 이상 입력해주세요." }),
    emailBody: z.string().min(5, { message: "자세한 내용은 5글자 이상 입력해주세요." }),
    tone: z.string().min(2, { message: "톤앤매너는 2글자 이상 입력해주세요." }),
    additionalInfo: z.string().optional(),
  }),
});

const dailyReflectionSchema = z.object({
  templateType: z.literal('dailyReflection'),
  inputs: z.object({
    moment: z.string().min(5, { message: "기억에 남는 순간은 5글자 이상 입력해주세요." }),
    feeling: z.string().min(2, { message: "감정은 2글자 이상 입력해주세요." }),
    learning: z.string().min(5, { message: "배운 점은 5글자 이상 입력해주세요." }),
    regret: z.string().optional(),
  }),
});

const combinedSchema = z.discriminatedUnion("templateType", [
  blogPromptSchema,
  emailPromptSchema,
  dailyReflectionSchema,
]);

// --- API 요청 처리 ---

export async function POST(request: Request) {
  // 보안 및 데이터 검사 (이전과 동일)
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const validationResult = combinedSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
          error: 'INVALID_INPUT', 
          details: validationResult.error.flatten().fieldErrors,
        },{ status: 400 });
    }
    
    const validatedData = validationResult.data;
    
    // --- 2단계 프롬프트 엔지니어링 시작 ---

    // 1. 1단계 프롬프트 (내부용): 사용자의 입력을 바탕으로, AI에게 '최종 프롬프트를 만들어달라'고 요청하는 우리만의 비밀 프롬프트.
    const metaPrompt = `
      You are an expert-level Prompt Engineer for a Korean audience. 
      Your task is to create a final, optimized, and effective prompt for a large language model based on the user's raw inputs.

      RULES:
      1. The final prompt must be a single, coherent paragraph written in natural Korean.
      2. It must include crucial English keywords in parentheses, like (keyword), to maximize the LLM's performance.
      3. DO NOT use markdown like '### Role' or bullet points. Combine everything into a professional, ready-to-use paragraph.
      4. The tone of the final prompt should be polite and direct.

      Here are the user's raw inputs:
      - Template Type: ${validatedData.templateType}
      - User Inputs: ${JSON.stringify(validatedData.inputs, null, 2)}

      Now, generate the final, user-facing prompt based on these rules and inputs.
    `;

    // 2. AI 호출 (1차): 비밀 프롬프트로 '최종 프롬프트'를 생성시킴
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(metaPrompt);
    const response = await result.response;
    const finalOptimizedPrompt = response.text(); // AI가 만들어준, 사용자에게 보여줄 최종 프롬프트

    // 3. 최종 결과 반환
    return NextResponse.json({ finalPrompt: finalOptimizedPrompt });

  } catch (e) {
    console.error("프롬프트 생성 실패:", e);
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 500 });
  }
}
