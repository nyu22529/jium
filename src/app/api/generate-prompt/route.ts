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

const blogPromptSchema = z.object({ /* ... */ });
const emailPromptSchema = z.object({ /* ... */ });
const combinedSchema = z.discriminatedUnion("templateType", [
  blogPromptSchema,
  emailPromptSchema,
]);

// --- API 요청 처리 ---

export async function POST(request: Request) {
  // ... (보안 검사, 데이터 검사 로직은 이전과 동일)
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 });
  }

  try {
    // ... (try 내부 로직은 이전과 동일)
    const body = await request.json();
    const validationResult = combinedSchema.safeParse(body);
    if (!validationResult.success) {
        return NextResponse.json({ error: 'INVALID_INPUT' /* ... */ }, { status: 400 });
    }
    const { templateType, inputs } = validationResult.data;
    let promptForAI = '';
    switch (templateType) {
        case 'blog':
            promptForAI = `...`;
            break;
        case 'email':
            promptForAI = `...`;
            break;
        default:
            return NextResponse.json({ error: 'INVALID_TEMPLATE_TYPE' }, { status: 400 });
    }
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(promptForAI);
    const response = await result.response;
    const text = response.text();
    return NextResponse.json({ finalPrompt: text });

  } catch (e) {
    // ✨ Vercel 로깅을 위한 간단한 console.error 사용 ✨
    // 나중에 Vercel에 배포하면, 이 로그가 자동으로 수집됩니다.
    console.error("프롬프트 생성 실패:", e);

    return NextResponse.json(
      { error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
