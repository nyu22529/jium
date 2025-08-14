import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Gemini API 클라이언트를 초기화합니다.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// 이 API는 /api/generate-prompt 경로로 POST 요청을 처리합니다.
export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 요청(Request)에서 JSON 데이터를 추출합니다.
    const body = await request.json();
    const { templateType, inputs } = body;

    // 2. 필수 값들이 있는지 확인합니다.
    if (!templateType || !inputs) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 3. 템플릿 종류에 따라 Gemini에게 보낼 프롬프트를 동적으로 생성합니다.
    let promptForAI = '';

    switch (templateType) {
      case 'blog':
        promptForAI = `
          ### 역할(Role)
          너는 ${inputs.targetAudience || '독자'}를 위한 IT 콘텐츠 크리에이터이자, 복잡한 기술을 아주 쉽게 설명해주는 전문가야.

          ### 맥락(Context)
          '${inputs.topic || '요청한 주제'}'에 대한 블로그 글을 작성하려고 해. 독자들이 이 글을 통해 유용한 정보를 얻고, 자신감을 얻게 하는 것이 목표야.

          ### 지시(Instruction)
          위 맥락에 맞춰, 블로그 글의 초안을 작성해줘.

          ### 제약(Constraints)
          - 전체 글자 수는 600자 내외로 작성해줘.
          - '${inputs.tone || '전문적인'}' 톤앤매너를 사용해줘.
          - ${inputs.constraints ? `그리고 다음 제약사항을 반드시 지켜줘: ${inputs.constraints}` : ''}
        `;
        break;
      
      // TODO: 나중에 'email', 'sns' 등 다른 템플릿 케이스를 추가할 수 있습니다.
      default:
        return NextResponse.json(
          { error: 'INVALID_TEMPLATE_TYPE', message: '지원하지 않는 템플릿 종류입니다.' },
          { status: 400 }
        );
    }

    // 4. 실제로 Gemini API를 호출합니다.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(promptForAI);
    const response = await result.response;
    const finalPrompt = response.text(); // Gemini가 생성한 최종 결과물

    // 5. 성공적으로 생성된 결과물을 프론트엔드로 보냅니다.
    return NextResponse.json({ finalPrompt });

  } catch (e) {
    // 6. 알 수 없는 서버 에러가 발생했을 때 처리합니다.
    console.error('프롬프트 생성 실패:', e);
    return NextResponse.json(
      { error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
