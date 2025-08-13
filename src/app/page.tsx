'use client'; // 이 파일이 클라이언트 컴포넌트임을 명시합니다.

import React, { useState, useRef, useEffect } from 'react';

// 메시지 타입을 정의합니다. (TypeScript)
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

// 추천 버튼 타입을 정의합니다.
interface Suggestion {
    text: string;
    templateType?: string; // 어떤 종류의 템플릿을 시작할지
    step?: string;         // 현재 어떤 단계인지
    key?: string;          // inputs 객체에 어떤 키로 저장할지
}

export default function JiumChatPage() {
  // 채팅 메시지들을 저장하는 상태
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: '안녕하세요! 저는 당신의 AI 어시스턴트, 지음입니다. 어떤 결과물을 만들고 싶으신가요?', sender: 'ai' },
  ]);
  
  // 추천 답변 버튼들을 저장하는 상태
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { text: '블로그 글쓰기', templateType: 'blog' },
    { text: '이메일 작성', templateType: 'email' },
    { text: 'SNS 홍보 문구', templateType: 'sns' },
  ]);

  // 사용자가 입력한 값을 저장하는 상태
  const [userInput, setUserInput] = useState('');
  // API 요청 중인지 여부를 저장하는 상태
  const [isLoading, setIsLoading] = useState(false);
  // 대화 흐름 데이터를 저장하는 상태
  const [conversationState, setConversationState] = useState({
    templateType: '',
    inputs: {}
  });

  // 스크롤을 맨 아래로 내리기 위한 참조
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 메시지가 추가될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // 메시지 전송 또는 버튼 클릭 처리 함수
  const handleSendMessage = async (text: string, suggestion?: Suggestion) => {
    // 사용자 메시지 추가
    const userMessage: Message = { id: Date.now(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setSuggestions([]); // 버튼을 누르면 현재 버튼들은 사라짐
    setIsLoading(true);

    try {
        // --- 여기서부터 대화 시나리오가 복잡해집니다 ---
        // 지금은 간단하게 API를 호출하는 로직만 구현합니다.
        // TODO: 실제 대화 흐름 관리 로직 구현 필요
        
        // 임시로 토픽을 설정하는 로직
        const newInputs = { ...conversationState.inputs, topic: text };
        const newTemplateType = suggestion?.templateType || conversationState.templateType;

        const response = await fetch('/api/generate-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                templateType: newTemplateType,
                inputs: newInputs,
            }),
        });

        if (!response.ok) {
            throw new Error('API 요청에 실패했습니다.');
        }

        const data = await response.json();

        // AI 응답 메시지 추가
        const aiMessage: Message = { id: Date.now() + 1, text: data.finalPrompt, sender: 'ai' };
        setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
        const errorMessage: Message = { id: Date.now() + 1, text: '죄송해요, 응답을 생성하는 데 문제가 생겼어요.', sender: 'ai' };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 text-gray-800 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl h-[90vh] max-h-[800px] bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
        
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white z-10 flex-shrink-0">
            <button className="p-2 rounded-full hover:bg-gray-100" aria-label="뒤로가기">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-800">Jium</h1>
            <button className="p-2 rounded-full hover:bg-gray-100" aria-label="메뉴">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
        </header>

        <main ref={chatContainerRef} id="chat-container" className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
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
            {suggestions.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2 pl-12">
                    {suggestions.map((sug) => (
                        <button key={sug.text} onClick={() => handleSendMessage(sug.text, sug)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all text-sm shadow-sm">
                            {sug.text}
                        </button>
                    ))}
                </div>
            )}
        </main>

        <footer className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); if(userInput.trim()) handleSendMessage(userInput); }} className="flex items-center gap-3">
                <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="직접 입력하거나 버튼을 선택하세요..." className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow" />
                <button type="submit" disabled={isLoading} className="p-3 bg-indigo-500 rounded-full text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-md disabled:bg-indigo-300 disabled:cursor-not-allowed" aria-label="전송">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
            </form>
        </footer>
      </div>
    </div>
  );
}
