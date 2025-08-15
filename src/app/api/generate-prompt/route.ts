import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Agent } from 'undici';

// --- 백엔드 설정: 보안 및 안정성 ---

// 1. Upstash Redis 연결 설정 (안정적인 undici Agent 사용)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  agent: new Agent({
    pipelining: 1,
    keepAliveTimeout: 10000,
    keepAliveMaxTimeout: 10000,
  }),
});

// 2. API 호출량 제한 규칙 설정 (60초에 10번)
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
});

// 3. Gemini API 클라이언트 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// 4. Zod를 사용한 엄격한 유효성 검사 규칙 정의
const blogPromptSchema = z.object({
  templateType: z.literal('blog'),
  inputs: z.object({
    topic: z.string().min(2, { message: "주제는 2글자 이상 입력해주세요." }),
    targetAudience: z.string().min(2, { message: "대상 독자는 2글자 이상 입력해주세요." }),
    tone: z.string().min(2, { message: "톤앤매너는 2글자 이상 입력해주세요." }),
    constraints: z.string().optional(),
  }),
});


// --- API 요청 처리 ---

export async function POST(request: Request) {
  // A. 보안 검사: 호출량 제한 확인
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();

    // B. 데이터 검사: 유효성 검사
    const validationResult = blogPromptSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
          error: 'INVALID_INPUT', 
          message: '입력값이 유효하지 않습니다.',
          details: validationResult.error.flatten().fieldErrors,
        },{ status: 400 });
    }

    const { templateType, inputs } = validationResult.data;
    
    // C. 핵심 로직: 프롬프트 생성
    let promptForAI = '';
    switch (templateType) {
      case 'blog':
        promptForAI = `
          ### 역할(Role)
          너는 ${inputs.targetAudience}를 위한 IT 콘텐츠 크리에이터이자, 복잡한 기술을 아주 쉽게 설명해주는 전문가야.
          ### 맥락(Context)
          '${inputs.topic}'에 대한 블로그 글을 작성하려고 해. 독자들이 이 글을 통해 유용한 정보를 얻고, 자신감을 얻게 하는 것이 목표야.
          ### 지시(Instruction)
          위 맥락에 맞춰, 블로그 글의 초안을 작성해줘.
          ### 제약(Constraints)
          - 전체 글자 수는 600자 내외로 작성해줘.
          - '${inputs.tone}' 톤앤매너를 사용해줘.
          - ${inputs.constraints ? `그리고 다음 제약사항을 반드시 지켜줘: ${inputs.constraints}` : ''}
        `;
        break;
      // TODO: 나중에 'email', 'sns' 템플릿 추가
      default:
        return NextResponse.json({ error: 'INVALID_TEMPLATE_TYPE' }, { status: 400 });
    }

    // D. AI 호출
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(promptForAI);
    const response = await result.response;
    const text = response.text();

    // E. 성공 응답
    return NextResponse.json({ finalPrompt: text });

  } catch (e) {
    // F. 예외 처리
    console.error('프롬프트 생성 실패:', e);
    return NextResponse.json(
      { error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}