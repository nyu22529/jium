import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Agent } from 'undici';

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

// --- 유효성 검사 규칙 확장 ---

// 1. '블로그' 템플릿 규칙 정의
const blogPromptSchema = z.object({
  templateType: z.literal('blog'),
  inputs: z.object({
    topic: z.string().min(2, { message: "주제는 2글자 이상 입력해주세요." }),
    targetAudience: z.string().min(2, { message: "대상 독자는 2글자 이상 입력해주세요." }),
    tone: z.string().min(2, { message: "톤앤매너는 2글자 이상 입력해주세요." }),
    constraints: z.string().optional(),
  }),
});

// 2. '이메일' 템플릿 규칙 새로 정의
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

// 3. 두 규칙을 하나로 합침: templateType 값에 따라 자동으로 맞는 규칙을 적용
const combinedSchema = z.discriminatedUnion("templateType", [
  blogPromptSchema,
  emailPromptSchema,
]);

// --- API 요청 처리 ---

export async function POST(request: Request) {
  // 보안 검사 (이전과 동일)
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 });
  }

  try {
    const body = await request.json();

    // 데이터 검사 (이제 합쳐진 규칙을 사용)
    const validationResult = combinedSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
          error: 'INVALID_INPUT', 
          details: validationResult.error.flatten().fieldErrors,
        },{ status: 400 });
    }

    const { templateType, inputs } = validationResult.data;
    
    let promptForAI = '';
    // 4. 핵심 로직: 'email' 케이스 추가
    switch (templateType) {
      case 'blog':
        // ... (블로그 프롬프트 생성 로직은 이전과 동일)
        promptForAI = `### 역할(Role)\n너는 ${inputs.targetAudience}를 위한 IT 콘텐츠 크리에이터야...\n`;
        break;
      
      case 'email':
        // 'email' 데이터 타입이 올바르게 추론됩니다.
        promptForAI = `
          ### 역할(Role)
          너는 상황 판단이 빠르고, 정중하지만 명확하게 자신의 용건을 전달하는 커뮤니케이션 전문가야.

          ### 맥락(Context)
          '${inputs.recipient}'에게 이메일을 작성해야 해. 핵심 용건은 '${inputs.purpose}'이고, 구체적인 내용은 다음과 같아: "${inputs.emailBody}".

          ### 지시(Instruction)
          위 맥락에 맞춰, 이메일의 초안을 작성해줘.

          ### 제약(Constraints)
          - '${inputs.tone}' 톤앤매너를 사용해줘.
          - ${inputs.additionalInfo ? `그리고 다음 추가 정보를 반드시 포함해줘: ${inputs.additionalInfo}` : ''}
          - 제목은 이메일의 핵심 내용이 잘 드러나도록 제안해줘.
        `;
        break;

      default:
        // 이 부분은 zod에서 이미 처리하지만, 안전장치로 남겨둡니다.
        return NextResponse.json({ error: 'INVALID_TEMPLATE_TYPE' }, { status: 400 });
    }

    // AI 호출 및 응답 (이전과 동일)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(promptForAI);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ finalPrompt: text });

  } catch (e) {
    console.error('프롬프트 생성 실패:', e);
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 500 });
  }
}
