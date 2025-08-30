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

// --- 유효성 검사 규칙 정의 ---
const namingSchema = z.object({
  templateType: z.literal('naming'),
  inputs: z.object({
    product: z.string().min(2, { message: "프로젝트/서비스 이름은 2글자 이상 입력해주세요." }),
    description: z.string().min(5, { message: "어떤 서비스인지 5글자 이상 설명해주세요." }),
    keywords: z.string().min(2, { message: "핵심 키워드는 2글자 이상 입력해주세요." }),
    language: z.string().optional(),
    concepts: z.string().optional(),
  }),
});

const coverLetterSchema = z.object({
  templateType: z.literal('coverLetter'),
  inputs: z.object({
    company: z.string().min(2, { message: "회사 이름은 2글자 이상 입력해주세요." }),
    position: z.string().min(2, { message: "지원 직무는 2글자 이상 입력해주세요." }),
    coreStrengths: z.string().min(10, { message: "핵심 역량은 10글자 이상 입력해주세요." }),
    tone: z.string().min(2, { message: "원하는 톤앤매너를 입력해주세요." }),
  }),
});

const codeSchema = z.object({
  templateType: z.literal('code'),
  inputs: z.object({
    language: z.string().min(1, { message: "프로그래밍 언어를 입력해주세요." }),
    description: z.string().min(10, { message: "필요한 기능은 10글자 이상 설명해주세요." }),
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

const reportSchema = z.object({
  templateType: z.literal('report'),
  inputs: z.object({
    topic: z.string().min(5, { message: "보고서 주제는 5글자 이상 입력해주세요." }),
    targetAudience: z.string().min(2, { message: "보고서 독자는 2글자 이상 입력해주세요." }),
    purpose: z.string().min(2, { message: "보고서의 목적을 입력해주세요." }),
  }),
});

const combinedSchema = z.discriminatedUnion("templateType", [
  namingSchema,
  coverLetterSchema,
  codeSchema,
  emailPromptSchema,
  reportSchema,
]);

// --- API 요청 처리 ---
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const validationResult = combinedSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'INVALID_INPUT',
        details: validationResult.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const validatedData = validationResult.data;

    const metaPrompt = `
      You are an expert-level Prompt Engineer for a Korean audience. 
      Your task is to create a final, optimized, and effective prompt for a large language model based on the user's raw inputs.

      RULES:
      1. The final prompt must be a single, coherent paragraph written in natural Korean.
      2. It must include crucial English keywords in parentheses, like (keyword), to maximize the LLM's performance.
      3. DO NOT use markdown like '### Role' or bullet points. Combine everything into a professional, ready-to-use paragraph.
      4. The tone of the final prompt should be polite and direct.
      5. Avoid redundancy and be as clear and concise as possible. (중복을 피하고 최대한 명료하게 작성)
      6. Seamlessly weave the values from 'User Inputs' into the paragraph. Do not explicitly mention the input keys (e.g., 'description'). Rephrase the user's raw input into a natural, human-like request. (사용자의 원시 입력을 그대로 나열하지 말고, 사람의 요청처럼 자연스러운 문장으로 재구성하여 녹여낼 것.)

      Here are the user's raw inputs:
      - Template Type: ${validatedData.templateType}
      - User Inputs: ${JSON.stringify(validatedData.inputs, null, 2)}

      Now, generate the final, user-facing prompt based on these rules and inputs.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(metaPrompt);
    const response = await result.response;
    const finalOptimizedPrompt = response.text();

    return NextResponse.json({ finalPrompt: finalOptimizedPrompt });

  } catch (e) {
    console.error("프롬프트 생성 실패:", e);
    return NextResponse.json({ error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' }, { status: 500 });
  }
}