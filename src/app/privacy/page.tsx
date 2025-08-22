import Link from 'next/link';
import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gray-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">개인정보처리방침</h1>
          <p className="text-sm text-gray-500 mt-2">시행일자: 2025년 8월 22일</p>
        </div>

        <div className="space-y-6 text-gray-700">
          <p>
            안녕하세요! AI 프롬프트 어시스턴트 '지음(Jium)' 팀입니다. 저희는 여러분의 개인정보를 소중하게 생각하며, 꼭 필요한 최소한의 정보만을 투명하게 처리하기 위해 노력하고 있습니다.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">1. 수집하는 개인정보 항목 및 수집 목적</h2>
            <p>
              저희 '지음'은 회원가입 없이 누구나 이용할 수 있으며, 여러분을 식별할 수 있는 이름, 이메일 등의 정보는 일절 수집하지 않습니다. 다만, 안정적인 서비스 제공과 부정 이용 방지를 위해 아래와 같은 정보가 자동으로, 그리고 익명으로 수집될 수 있습니다.
            </p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-gray-50 p-4 rounded-lg">
              <li><strong>수집 항목:</strong> IP 주소</li>
              <li><strong>수집 목적:</strong> 서비스의 비정상적인 사용(과도한 호출 등)을 방지하여 모든 사용자에게 공정한 서비스 이용 기회를 제공하기 위함 (호출량 제한 시스템 운영)</li>
            </ul>
            <p className="mt-2">
              이 정보는 개인을 특정할 수 없는 형태로 사용되며, 오직 서비스 보안 목적으로만 활용됩니다.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">2. 제3자 서비스 이용에 대한 안내</h2>
            <p>
              '지음'은 사용자의 요청에 따라 최적의 프롬프트를 생성하기 위해 Google의 Gemini API를 사용하고 있습니다. 여러분이 입력한 내용은 Google의 서버로 전송되어 처리됩니다. Google의 개인정보 처리에 대한 자세한 내용은 아래 링크를 통해 확인하실 수 있습니다.
            </p>
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline">
              Google 개인정보처리방침
            </a>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">3. 개인정보 보유 및 이용 기간</h2>
            <p>
              저희는 수집된 IP 주소를 호출량 제한 시스템 운영을 위한 최소한의 기간(최대 24시간) 동안만 일시적으로 보유하며, 이 기간이 지나면 즉시 파기합니다.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">4. 문의처</h2>
            <p>
              개인정보처리방침에 대해 궁금한 점이 있으시면 아래 이메일로 언제든지 문의해주세요.
            </p>
            <p className="font-medium">이메일: jium.assistant@gmail.com</p>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-medium">
            &larr; 채팅으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
