import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { z } from 'zod'; // zod를 가져옵니다.

// Gemini API 클라이언트를 초기화합니다.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// 1. zod를 사용해 요청 데이터의 유효성 검사 규칙(Schema)을 정의합니다.
const blogPromptSchema = z.object({
  templateType: z.literal('blog'), // templateType은 반드시 'blog'여야 합니다.
  inputs: z.object({
    topic: z.string().min(2, { message: "주제는 2글자 이상 입력해주세요." }), // topic은 2글자 이상의 문자열이어야 합니다.
    targetAudience: z.string().min(2, { message: "대상 독자는 2글자 이상 입력해주세요." }),
    tone: z.string().min(2, { message: "톤앤매너는 2글자 이상 입력해주세요." }),
    constraints: z.string().optional(), // constraints는 문자열이지만, 필수는 아닙니다.
  }),
});

// 이 API는 /api/generate-prompt 경로로 POST 요청을 처리합니다.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 2. 받은 데이터(body)를 우리가 정의한 규칙(Schema)으로 검사합니다.
    const validationResult = blogPromptSchema.safeParse(body);

    // 3. 유효성 검사에 실패했을 경우, 구체적인 에러 메시지를 반환합니다.
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'INVALID_INPUT', 
          message: '입력값이 유효하지 않습니다.',
          details: validationResult.error.flatten().fieldErrors, // 어떤 필드가 왜 잘못되었는지 상세 정보 추가
        },
        { status: 400 }
      );
    }

    // 유효성 검사를 통과한 안전한 데이터만 사용합니다.
    const { templateType, inputs } = validationResult.data;

    // 4. 템플릿 종류에 따라 Gemini에게 보낼 프롬프트를 동적으로 생성합니다.
    // (이 부분은 이전과 동일합니다)
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
      default:
        // 이 부분은 zod 스키마에서 이미 처리되지만, 안전장치로 남겨둡니다.
        return NextResponse.json({ error: 'INVALID_TEMPLATE_TYPE' }, { status: 400 });
    }

    // 5. 실제로 Gemini API를 호출합니다.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(promptForAI);
    const response = await result.response;
    const finalPrompt = response.text();

    return NextResponse.json({ finalPrompt });

  } catch (e) {
    console.error('프롬프트 생성 실패:', e);
    return NextResponse.json(
      { error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
