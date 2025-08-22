'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// --- 타입 정의 ---
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  isFinal?: boolean;
}
interface Suggestion {
  text: string;
  isFinal?: boolean; 
}
type ConversationInputs = Record<string, string>;
interface ConversationStep {
  question: string;
  key: string;
  suggestions?: Suggestion[];
  isButtonOnly?: boolean; // 버튼 전용 단계를 위한 플래그
}

// --- 대화 시나리오 정의 ---
const conversationFlows: Record<string, ConversationStep[]> = {
  '블로그 글쓰기': [
    { question: '어떤 주제에 대해 글을 쓸까요?', key: 'topic' },
    { question: '글을 읽는 독자는 누구인가요?', key: 'targetAudience' },
    { question: '어떤 톤으로 글을 쓸까요?', key: 'tone', suggestions: [{ text: '친근하게' }, { text: '전문적으로' }, { text: '유머있게' }] },
    { question: '글에 꼭 포함되어야 할 내용이 있나요? (없으면 "없음")', key: 'constraints' },
    { question: '모든 준비가 끝났어요! 아래 버튼을 눌러 글을 생성해 보세요.', key: 'final', suggestions: [{ text: '✨ 프롬프트 생성하기', isFinal: true }], isButtonOnly: true },
  ],
  '이메일 작성': [
    { question: '누구에게 보내는 이메일인가요?', key: 'recipient' },
    { question: '이메일을 보내는 핵심 목적은 무엇인가요?', key: 'purpose' },
    { question: '이메일에 들어갈 핵심 내용을 알려주세요.', key: 'emailBody' },
    { question: '어떤 톤으로 작성할까요?', key: 'tone', suggestions: [{ text: '정중하게' }, { text: '친근하게' }, { text: '간결하게' }] },
    { question: '추가로 포함하고 싶은 정보가 있나요? (없으면 "없음")', key: 'additionalInfo' },
    { question: '좋아요! 아래 버튼을 눌러 이메일 초안을 생성해 보세요.', key: 'final', suggestions: [{ text: '✨ 이메일 생성하기', isFinal: true }], isButtonOnly: true },
  ],
  '오늘의 회고': [
    { question: '오늘 가장 인상 깊었거나 기억에 남는 순간은 무엇이었나요?', key: 'moment' },
    { question: '그 순간 어떤 감정을 느꼈나요?', key: 'feeling' },
    { question: '그 경험을 통해 무엇을 배우거나 느꼈나요?', key: 'learning' },
    { question: '혹시 아쉬웠던 점이나, 내일을 위한 다짐이 있다면 들려주세요. (없으면 "없음")', key: 'regret' },
    { question: '당신의 하루를 들려줘서 고마워요. 회고 글을 작성해 드릴게요.', key: 'final', suggestions: [{ text: '✨ 회고 글 생성하기', isFinal: true }], isButtonOnly: true },
  ],
};

// --- 초기 상태 정의 ---
const initialMessages: Message[] = [
    { id: 1, text: '안녕하세요! 저는 당신의 AI 어시스턴트, 지음입니다. 어떤 결과물을 만들고 싶으신가요?', sender: 'ai' },
];
const initialSuggestions: Suggestion[] = [
    { text: '블로그 글쓰기' },
    { text: '이메일 작성' },
    { text: '오늘의 회고' },
];
const initialConversationState = {
    templateType: null,
    currentStep: 0,
    inputs: {},
};

// --- 메인 컴포넌트 ---
export default function JiumChatPage() {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
    const [isButtonOnly, setIsButtonOnly] = useState(true); // UX 개선: 버튼 전용 상태 추가
    const [conversationState, setConversationState] = useState<{
        templateType: string | null;
        currentStep: number;
        inputs: ConversationInputs;
    }>(initialConversationState);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messageIdCounter = useRef(initialMessages.length + 1);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const getUniqueId = () => {
        const newId = messageIdCounter.current;
        messageIdCounter.current += 1;
        return newId;
    };

    const handleRestart = (isFollowUp: boolean = false) => {
        setConversationState(initialConversationState);
        if (isFollowUp) {
            const restartMessage: Message = { id: getUniqueId(), text: "다른 결과물을 만들어 드릴까요?", sender: 'ai' };
            setMessages(prev => [...prev, restartMessage]);
        } else {
            setMessages(initialMessages);
            messageIdCounter.current = initialMessages.length + 1;
        }
        setSuggestions(initialSuggestions);
        setIsButtonOnly(true); // 다시 시작할 때도 버튼 전용으로
    };

    const handleFinalGenerate = async () => {
        if (!conversationState.templateType) return;
        setIsLoading(true);
        setSuggestions([]);
        try {
            let apiTemplateType = '';
            if (conversationState.templateType === '블로그 글쓰기') apiTemplateType = 'blog';
            else if (conversationState.templateType === '이메일 작성') apiTemplateType = 'email';
            else if (conversationState.templateType === '오늘의 회고') apiTemplateType = 'dailyReflection';

            const response = await fetch('/api/generate-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateType: apiTemplateType,
                    inputs: conversationState.inputs,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                const errorText = data.details ? `입력값 오류: ${Object.values(data.details.inputs).flat().join(', ')}` : (data.message || data.error);
                throw new Error(errorText);
            }
            
            const aiFinalMessage: Message = { id: getUniqueId(), text: data.finalPrompt, sender: 'ai', isFinal: true };
            setMessages(prev => [...prev, aiFinalMessage]);
        } catch (error: any) {
            const errorMessage: Message = { id: getUniqueId(), text: `죄송해요, 생성 중 문제가 발생했어요.\n\n[에러 상세]\n${error.message}`, sender: 'ai' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => handleRestart(true), 1000);
        }
    };

    const handleSendMessage = (text: string, suggestion?: Suggestion) => {
        if (!text.trim()) return;
        const userMessage: Message = { id: getUniqueId(), text, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setSuggestions([]);

        if (suggestion?.isFinal) {
            handleFinalGenerate();
            return;
        }
        
        if (!conversationState.templateType) {
            const selectedTemplate = Object.keys(conversationFlows).find(key => text.includes(key));
            if (selectedTemplate) {
                const flow = conversationFlows[selectedTemplate];
                const firstStep = flow[0];
                const firstAiMessage: Message = { id: getUniqueId(), text: firstStep.question, sender: 'ai' };
                setMessages(prev => [...prev, firstAiMessage]);
                setSuggestions(firstStep.suggestions || []);
                setIsButtonOnly(!!firstStep.isButtonOnly); // UX 개선: 다음 단계의 버튼 전용 여부 설정
                setConversationState({ templateType: selectedTemplate, currentStep: 0, inputs: {} });
            } else {
                const unsupportedMessage: Message = { id: getUniqueId(), text: '죄송해요, 아직 지원하지 않는 기능이에요. 아래 버튼 중에서 선택해 주시겠어요?', sender: 'ai' };
                setMessages(prev => [...prev, unsupportedMessage]);
                setSuggestions(initialSuggestions);
                setIsButtonOnly(true);
            }
        } else {
            if (text.trim().length < 2 && !suggestion) {
                const askForDetailsMessage: Message = { id: getUniqueId(), text: '죄송하지만, 조금 더 자세하게 말씀해주시겠어요?', sender: 'ai' };
                setMessages(prev => [...prev, askForDetailsMessage]);
                const flow = conversationFlows[conversationState.templateType];
                if (flow) {
                    const currentStepInfo = flow[conversationState.currentStep];
                    setSuggestions(currentStepInfo.suggestions || []);
                }
                return;
            }

            const flow = conversationFlows[conversationState.templateType];
            if (flow) {
                const currentStepInfo = flow[conversationState.currentStep];
                const newInputs = { ...conversationState.inputs, [currentStepInfo.key]: text };
                const nextStepIndex = conversationState.currentStep + 1;
                if (nextStepIndex < flow.length) {
                    const nextStep = flow[nextStepIndex];
                    const newAiMessage: Message = { id: getUniqueId(), text: nextStep.question, sender: 'ai' };
                    setMessages(prev => [...prev, newAiMessage]);
                    setSuggestions(nextStep.suggestions || []);
                    setIsButtonOnly(!!nextStep.isButtonOnly); //  UX 개선: 다음 단계의 버튼 전용 여부 설정
                    setConversationState(prev => ({ ...prev, currentStep: nextStepIndex, inputs: newInputs }));
                }
            }
        }
    };

    const handleCopyToClipboard = (text: string, messageId: number) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            console.error('클립보드 복사 실패:', err);
        }
        document.body.removeChild(textArea);
    };

    return (
        <div className="bg-gray-50 text-gray-800 flex items-center justify-center min-h-screen">
          <div className="w-full max-w-2xl h-[90vh] max-h-[800px] bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
            <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white z-10 flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-800">Jium</h1>
              <button onClick={() => handleRestart(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="다시 시작">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0 8.25 8.25 0 0 0 0-11.667l-3.182-3.182m0-4.991v4.99" />
                </svg>
              </button>
            </header>
            <main ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-2">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.sender === 'ai' ? (
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 shadow-md"></div>
                      <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none max-w-lg shadow-sm">
                        <p className="text-base whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end mb-4">
                      <div className="bg-indigo-500 text-white p-4 rounded-2xl rounded-br-none max-w-lg shadow-sm">
                        <p className="text-base">{msg.text}</p>
                      </div>
                    </div>
                  )}
                  {msg.isFinal && (
                    <div className="flex justify-start pl-12 -mt-2">
                        <button onClick={() => handleCopyToClipboard(msg.text, msg.id)} className="text-sm border bg-white border-gray-300 rounded-full px-3 py-1 hover:bg-gray-100 transition-colors flex items-center gap-2">
                            {copiedMessageId === msg.id ? '복사 완료!' : '복사하기'}
                        </button>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && ( <div key="loading" className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0"></div><div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none">...생성 중...</div></div> )}
              {!isLoading && suggestions.length > 0 && (
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
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(userInput); }} className="flex items-center gap-3">
                {/* UX 개선: isButtonOnly 상태에 따라 입력창 비활성화 */}
                <input 
                  type="text" 
                  value={userInput} 
                  onChange={(e) => setUserInput(e.target.value)} 
                  placeholder={isButtonOnly ? "버튼을 선택해주세요..." : "직접 입력하거나 버튼을 선택하세요..."}
                  className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100" 
                  disabled={isLoading || isButtonOnly} 
                />
                <button type="submit" disabled={isLoading || !userInput.trim() || isButtonOnly} className="p-3 bg-indigo-500 rounded-full text-white hover:bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed" aria-label="전송">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                </button>
              </form>
              <div className="text-center mt-3">
                <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                  개인정보처리방침
                </Link>
              </div>
            </footer>
          </div>
        </div>
    );
}
