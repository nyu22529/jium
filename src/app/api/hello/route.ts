// src/app/api/hello/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 이곳에 나중에 복잡한 로직이 들어갈 수 있습니다.
  // (예: 데이터베이스 조회, 계산 등)

  // 지금은 간단한 JSON 응답만 반환합니다.
  return NextResponse.json({ message: "Hello, Jium!" });
}