import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Agent } from 'undici';

// --- 백엔드 설정 (이전과 동일) ---
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

// 1. 기존 템플릿 규칙들
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

// 2. '하루 회고' 템플릿 규칙 새로 정의
const dailyReflectionSchema = z.object({
  templateType: z.literal('dailyReflection'),
  inputs: z.object({
    moment: z.string().min(5, { message: "기억에 남는 순간은 5글자 이상 입력해주세요." }),
    feeling: z.string().min(2, { message: "감정은 2글자 이상 입력해주세요." }),
    learning: z.string().min(5, { message: "배운 점은 5글자 이상 입력해주세요." }),
    regret: z.string().optional(),
  }),
});

// 3. 세 가지 규칙을 모두 합침
const combinedSchema = z.discriminatedUnion("templateType", [
  blogPromptSchema,
  emailPromptSchema,
  dailyReflectionSchema, // 새로 추가
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

    const { templateType, inputs } = validationResult.data;
    
    let promptForAI = '';
    
    // 4. 핵심 로직: 'dailyReflection' 케이스 추가
    switch (templateType) {
      case 'blog':
        promptForAI = `### 역할(Role)\n너는 ${inputs.targetAudience}를 위한 IT 콘텐츠 크리에이터야...\n`;
        break;
      
      case 'email':
        promptForAI = `### 역할(Role)\n너는 커뮤니케이션 전문가야...\n`;
        break;

      case 'dailyReflection':
        promptForAI = `
          ### 역할(Role)
          너는 공감 능력이 뛰어나고 따뜻한 시선을 가진 라이프 코치이자, 하루의 경험에서 의미를 찾아주는 저널링 파트너야.

          ### 맥락(Context)
          나는 오늘 하루를 마무리하며 회고를 하고 있어. 오늘 나에게 있었던 가장 중요한 사건은 "${inputs.moment}"이고, 그때 "${inputs.feeling}"을 느꼈어. 이 경험을 통해 "${inputs.learning}"라는 교훈을 얻었지.
          ${inputs.regret ? `한편으로는 "${inputs.regret}" 라는 생각도 들었어.` : ''}

          ### 지시(Instruction)
          위 맥락을 바탕으로, 나의 하루를 정리하고 성찰할 수 있는 따뜻한 회고록 초안을 작성해줘. 나의 성취를 축하해주고, 배움의 가치를 되새겨주며, 아쉬웠던 점에 대해서는 따뜻한 격려와 함께 앞으로 나아갈 수 있는 긍정적인 메시지를 담아줘.

          ### 제약(Constraints)
          - 전체 글은 3~4문단으로 구성해줘.
          - 친근하고 다정한 말투를 사용해줘.
          ${inputs.regret && inputs.regret.includes("잘했어") ? '- 마지막에는 내가 나에게 해준 말("그래도 잘했어!")을 인용해서 마무리해줘.' : ''}
        `;
        break;

      default:
        return NextResponse.json({ error: 'INVALID_TEMPLATE_TYPE' }, { status: 400 });
    }

    // AI 호출 및 응답 (이전과 동일)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(promptForAI);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ finalPrompt: text });

  } catch (e) {
    console.error("프롬프트 생성 실패:", e);
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 500 });
  }
}
