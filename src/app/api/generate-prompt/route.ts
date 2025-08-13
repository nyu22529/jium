import { NextResponse } from 'next/server';

// 이 API는 /api/generate-prompt 경로로 POST 요청을 처리합니다.
export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 요청(Request)에서 JSON 데이터를 추출합니다.
    const body = await request.json();
    const { templateType, inputs } = body;

    // 2. 필수 값들이 있는지 확인합니다. (API 명세서의 INVALID_INPUT 에러 처리)
    if (!templateType || !inputs) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 3. (임시) 실제 Gemini API를 호출하는 대신, 테스트용 응답을 생성합니다.
    // TODO: 여기에 실제 Gemini API 호출 로직을 구현해야 합니다.
    const finalPrompt = `### 역할(Role)\n너는 ${inputs.targetAudience || '사용자'}를 위한 ${templateType} 전문가야.\n\n### 지시(Instruction)\n'${inputs.topic || '요청한 주제'}'에 대해 ${inputs.tone || '전문적인'} 톤으로 글을 작성해줘.`;

    // 4. 성공적으로 생성된 프롬프트를 프론트엔드로 보냅니다.
    return NextResponse.json({ finalPrompt });

  } catch (e) {
    // 5. 알 수 없는 서버 에러가 발생했을 때 처리합니다. (GENERATION_FAILED 등)
    console.error('프롬프트 생성 실패:', e);
    return NextResponse.json(
      { error: 'GENERATION_FAILED', message: '프롬프트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
