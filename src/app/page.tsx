'use client';

import React, { useState, useRef, useEffect } from 'react';

// --- 타입 정의 ---
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

interface Suggestion {
  text: string;
  isFinal?: boolean; // '생성하기' 버튼인지 여부
}

interface ConversationStep {
  question: string;
  key: keyof ConversationInputs; // inputs 객체의 어떤 키에 저장할지
  suggestions?: Suggestion[];
}

interface ConversationInputs {
  topic?: string;
  targetAudience?: string;
  tone?: string;
  constraints?: string;
}

// --- 대화 시나리오 정의 ---
const conversationFlows: Record<string, ConversationStep[]> = {
  blog: [
    { question: '어떤 주제에 대해 글을 쓸까요?', key: 'topic' },
    { question: '글을 읽는 독자는 누구인가요?', key: 'targetAudience', suggestions: [{ text: '대학생' }, { text: '직장인' }, { text: '개발자' }] },
    { question: '어떤 톤으로 글을 쓸까요?', key: 'tone', suggestions: [{ text: '친근하게' }, { text: '전문적으로' }, { text: '유머있게' }] },
    { question: '글에 꼭 포함되어야 할 내용이 있나요? (없으면 "없음"이라고 입력)', key: 'constraints' },
    { question: '모든 준비가 끝났어요! 아래 버튼을 눌러 글을 생성해 보세요.', key: 'constraints', suggestions: [{ text: '✨ 프롬프트 생성하기', isFinal: true }] },
  ],
  // TODO: email, sns 등 다른 시나리오 추가
};

export default function JiumChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: '안녕하세요! 저는 당신의 AI 어시턴트, 지음입니다. 어떤 결과물을 만들고 싶으신가요?', sender: 'ai' },
  ]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { text: '블로그 글쓰기' },
    { text: '이메일 작성' },
    { text: 'SNS 홍보 문구' },
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- 대화 상태 관리 ---
  const [conversationState, setConversationState] = useState<{
    templateType: string | null;
    currentStep: number;
    inputs: ConversationInputs;
  }>({
    templateType: null,
    currentStep: 0,
    inputs: {},
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [messages]);

  // --- 다음 대화 단계로 진행하는 함수 ---
  const proceedToNextStep = (flow: ConversationStep[], newInputs: ConversationInputs) => {
    const nextStepIndex = conversationState.currentStep + 1;
    if (nextStepIndex < flow.length) {
      const nextStep = flow[nextStepIndex];
      setMessages(prev => [...prev, { id: Date.now(), text: nextStep.question, sender: 'ai' }]);
      setSuggestions(nextStep.suggestions || []);
      setConversationState(prev => ({ ...prev, currentStep: nextStepIndex, inputs: newInputs }));
    }
  };

  // --- API 호출 및 최종 결과 표시 함수 ---
  const handleFinalGenerate = async () => {
    if (!conversationState.templateType) return;

    setIsLoading(true);
    setSuggestions([]);

    try {
      // To-Do 1 & 2: fetch를 사용해 API로 POST 요청 보내기 (body에 데이터 담기)
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: conversationState.templateType,
          inputs: conversationState.inputs,
        }),
      });

      if (!response.ok) throw new Error('API 요청 실패');

      const data = await response.json();

      // To-Do 3: 백엔드 응답을 채팅창에 새 메시지로 추가
      const aiFinalMessage: Message = { id: Date.now(), text: data.finalPrompt, sender: 'ai' };
      setMessages(prev => [...prev, aiFinalMessage]);

    } catch (error) {
      const errorMessage: Message = { id: Date.now(), text: '죄송해요, 생성 중 문제가 발생했어요.', sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // TODO: 대화 초기화 또는 다음 행동 제안 로직 추가
    }
  };

  // --- 메시지 전송 및 대화 흐름 관리 함수 ---
  const handleSendMessage = (text: string, suggestion?: Suggestion) => {
    const userMessage: Message = { id: Date.now(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');

    // 최종 '생성하기' 버튼 클릭 시
    if (suggestion?.isFinal) {
      handleFinalGenerate();
      return;
    }

    // 대화 시작 (템플릿 선택)
    if (!conversationState.templateType) {
      const selectedTemplate = text.includes('블로그') ? 'blog' : null; // 단순 예시
      if (selectedTemplate && conversationFlows[selectedTemplate]) {
        const flow = conversationFlows[selectedTemplate];
        const firstStep = flow[0];
        setMessages(prev => [...prev, { id: Date.now() + 1, text: firstStep.question, sender: 'ai' }]);
        setSuggestions(firstStep.suggestions || []);
        setConversationState({ templateType: selectedTemplate, currentStep: 0, inputs: {} });
      }
    } else {
      // 대화 진행 중
      const flow = conversationFlows[conversationState.templateType];
      if (flow) {
        const currentStepInfo = flow[conversationState.currentStep];
        const newInputs = { ...conversationState.inputs, [currentStepInfo.key]: text };
        proceedToNextStep(flow, newInputs);
      }
    }
  };

  return (
    <div className="bg-gray-50 text-gray-800 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl h-[90vh] max-h-[800px] bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white z-10 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-800">Jium</h1>
        </header>
        <main ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
          {messages.map((msg) => (
            msg.sender === 'ai' ? (
              <div key={msg.id} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 shadow-md"></div>
                <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none max-w-lg shadow-sm">
                  <p className="text-base whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-indigo-500 text-white p-4 rounded-2xl rounded-br-none max-w-lg shadow-sm">
                  <p className="text-base">{msg.text}</p>
                </div>
              </div>
            )
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 shadow-md animate-pulse"></div>
              <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none max-w-lg shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
          {suggestions.length > 0 && !isLoading && (
            <div className="flex flex-wrap justify-end gap-2 pl-12">
              {suggestions.map((sug) => (
                <button key={sug.text} onClick={() => handleSendMessage(sug.text, sug)} className={`border text-sm px-4 py-2 rounded-full transition-all shadow-sm ${sug.isFinal ? 'bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                  {sug.text}
                </button>
              ))}
            </div>
          )}
        </main>
        <footer className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); if (userInput.trim()) handleSendMessage(userInput); }} className="flex items-center gap-3">
            <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="직접 입력하거나 버튼을 선택하세요..." className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="submit" disabled={isLoading} className="p-3 bg-indigo-500 rounded-full text-white hover:bg-indigo-600 disabled:bg-indigo-300" aria-label="전송">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
