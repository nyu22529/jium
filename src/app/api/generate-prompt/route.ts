import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// 1. Zod를 사용해 프론트엔드에서 받을 데이터의 형식을 정의하고 검증합니다.
const promptSchema = z.object({
  templateType: z.string().min(1, "템플릿 종류는 필수입니다."),
  inputs: z.object({
    topic: z.string().optional(),
    targetAudience: z.string().optional(),
    tone: z.string().optional(),
    constraints: z.string().optional(),
  }).passthrough(), // 정의되지 않은 추가 속성도 허용
});

// 2. Gemini API 클라이언트를 초기화합니다. API 키는 .env.local 파일에서 안전하게 불러옵니다.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 3. Zod를 사용해 들어온 데이터를 파싱하고 검증합니다. 실패하면 에러를 던집니다.
    const validation = promptSchema.safeParse(body);
    if (!validation.success) {
      // 수정된 부분: validation.error.errors -> validation.error.issues
      const errorMessage = validation.error.issues.map(e => e.message).join(', ');
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: errorMessage },
        { status: 400 }
      );
    }
    
    const { templateType, inputs } = validation.data;

    // 4. (개선된 프롬프트) API 명세서에 맞게, 더 구체적인 최종 프롬프트를 생성합니다.
    const finalPrompt = `
      ### 역할(Role)
      너는 IT 콘텐츠 크리에이터이자, 복잡한 기술을 ${inputs.targetAudience || '독자'} 눈높이에 맞춰 아주 쉽게 설명해주는 전문가야.

      ### 맥락(Context)
      '${templateType}' 형식으로 글을 작성하려고 해. 주제는 '${inputs.topic || '정해진 주제 없음'}'이고, 전체적인 톤은 '${inputs.tone || '일반적인'}' 톤을 유지해야 해.

      ### 지시(Instruction)
      위 역할과 맥락에 맞춰, 글의 초안을 작성해줘.

      ### 제약(Constraints)
      - ${inputs.constraints || '특별한 제약 없음'}
      - 결과는 마크다운 형식으로 작성해줘.
    `;

    // 5. Gemini 모델을 선택하고, 생성된 프롬프트로 텍스트 생성을 요청합니다.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();

    // 6. 성공적으로 생성된 텍스트를 프론트엔드로 보냅니다.
    // finalPrompt 대신 실제 AI가 생성한 text를 보내도록 수정했습니다.
    return NextResponse.json({ finalPrompt: text });

  } catch (e) {
    console.error('프롬프트 생성 실패:', e);
    return NextResponse.json(
      { error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
