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
  isButtonOnly?: boolean;
}

// --- 최종 수정된 대화 시나리오 정의 ---
const conversationFlows: Record<string, ConversationStep[]> = {
  'AI 네이밍': [
    { question: '어떤 프로젝트나 서비스를 위한 이름인가요?', key: 'product' },
    { question: '무엇을 하는 서비스인지 핵심 기능을 설명해주세요.', key: 'description' },
    { question: '이름에 담고 싶은 핵심 키워드나 분위기를 알려주세요.', key: 'keywords' },
    { question: '이름에 담고 싶은 특별한 컨셉이 있다면 알려주세요. (예: 강력함, 재치, 신비로움)', key: 'concepts' },
    { question: '선호하는 언어가 있나요? (없으면 "없음")', key: 'language', suggestions: [{ text: '한글' }, { text: '영어' }, { text: '상관없음' }] },
    { question: '모든 정보를 종합하여 세상에 하나뿐인 이름을 만들어 드릴게요!', key: 'final', suggestions: [{ text: '이름 생성하기', isFinal: true }], isButtonOnly: true },
  ],
  '자기소개서 초안 작성': [
    { question: '어느 회사(또는 가게)에 지원하시나요?', key: 'company' },
    { question: '어떤 직무에 지원하시나요?', key: 'position' },
    { question: '가장 강조하고 싶은 자신의 핵심 역량과 경험을 10자 이상 알려주세요.', key: 'coreStrengths' },
    { question: '어떤 톤의 자기소개서를 원하시나요?', key: 'tone', suggestions: [{ text: '적극적이고 자신감있게' }, { text: '논리적이고 침착하게' }, { text: '창의적이고 독창적이게' }] },
    { question: '훌륭해요! 당신의 매력이 드러나는 자기소개서 초안을 작성해 드릴게요.', key: 'final', suggestions: [{ text: '자소서 초안 생성하기', isFinal: true }], isButtonOnly: true },
  ],
  '코드 스니펫 생성': [
    { question: '어떤 프로그래밍 언어가 필요한가요?', key: 'language', suggestions: [{ text: 'JavaScript' }, { text: 'Python' }, { text: 'Java' }] },
    { question: '어떤 기능을 하는 코드가 필요한가요? 10자 이상 자세히 설명해주세요.', key: 'description' },
    { question: '특별히 사용해야 할 라이브러리나 프레임워크가 있나요? (없으면 "없음")', key: 'constraints' },
    { question: '알겠습니다! 요청하신 기능의 코드 스니펫을 생성해 드릴게요.', key: 'final', suggestions: [{ text: '코드 생성하기', isFinal: true }], isButtonOnly: true },
  ],
  '상황별 이메일 작성': [
    { question: '누구에게 보내는 이메일인가요?', key: 'recipient' },
    { question: '이메일을 보내는 핵심 목적은 무엇인가요?', key: 'purpose' },
    { question: '이메일에 들어갈 핵심 내용을 5자 이상 알려주세요.', key: 'emailBody' },
    { question: '어떤 톤으로 작성할까요?', key: 'tone', suggestions: [{ text: '정중하게' }, { text: '친근하게' }, { text: '간결하게' }] },
    { question: '추가로 포함하고 싶은 정보가 있나요? (없으면 "없음")', key: 'additionalInfo' },
    { question: '필요한 정보를 모두 확인했어요. 상황에 꼭 맞는 이메일을 작성해 드릴게요.', key: 'final', suggestions: [{ text: '이메일 생성하기', isFinal: true }], isButtonOnly: true },
  ],
  'AI 리서치 보고서': [
    { question: '보고서의 핵심 주제는 무엇인가요? 5자 이상 입력해주세요.', key: 'topic' },
    { question: '이 보고서를 읽게 될 주된 독자는 누구인가요? (예: 대학생, 직장인, 교수님)', key: 'targetAudience' },
    { question: '보고서의 핵심 목적은 무엇인가요?', key: 'purpose', suggestions: [{ text: '정보 전달' }, { text: '주장 및 설득' }, { text: '현황 분석' }] },
    { question: '네, 좋습니다! 주제에 대한 심도 있는 보고서 초안을 작성해 드릴게요.', key: 'final', suggestions: [{ text: '보고서 초안 생성하기', isFinal: true }], isButtonOnly: true },
  ],
};

// --- 초기 상태 정의 ---
const initialMessages: Message[] = [
    { id: 1, text: '안녕하세요! 저는 당신의 AI 어시스턴트, 지음입니다. 어떤 결과물을 만들고 싶으신가요?', sender: 'ai' },
];
const initialSuggestions: Suggestion[] = [
    { text: 'AI 네이밍' },
    { text: '자기소개서 초안 작성' },
    { text: '코드 스니펫 생성' },
    { text: '상황별 이메일 작성' },
    { text: 'AI 리서치 보고서' },
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
    const [isButtonOnly, setIsButtonOnly] = useState(true);
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
        setIsButtonOnly(true);
    };

    const handleFinalGenerate = async () => {
        if (!conversationState.templateType) return;
        setIsLoading(true);
        setSuggestions([]);
        try {
            let apiTemplateType = '';
            const currentTemplate = conversationState.templateType;
            if (currentTemplate === 'AI 네이밍') apiTemplateType = 'naming';
            else if (currentTemplate === '자기소개서 초안 작성') apiTemplateType = 'coverLetter';
            else if (currentTemplate === '코드 스니펫 생성') apiTemplateType = 'code';
            else if (currentTemplate === '상황별 이메일 작성') apiTemplateType = 'email';
            else if (currentTemplate === 'AI 리서치 보고서') apiTemplateType = 'report';

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
                const errorText = data.details ? `입력값 오류: ${Object.values(data.details.inputs || {}).flat().join(', ')}` : (data.message || data.error);
                throw new Error(errorText);
            }
            
            const aiFinalMessage: Message = { id: getUniqueId(), text: data.finalPrompt, sender: 'ai', isFinal: true };
            setMessages(prev => [...prev, aiFinalMessage]);
        } catch (error: unknown) {
            const errorAsError = error as Error;
            const errorMessage: Message = { id: getUniqueId(), text: `죄송해요, 생성 중 문제가 발생했어요.\n\n[에러 상세]\n${errorAsError.message}`, sender: 'ai' };
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
                setIsButtonOnly(!!firstStep.isButtonOnly);
                setConversationState({ templateType: selectedTemplate, currentStep: 0, inputs: {} });
            } else {
                const unsupportedMessage: Message = { id: getUniqueId(), text: '죄송해요, 아직 지원하지 않는 기능이에요. 아래 버튼 중에서 선택해 주시겠어요?', sender: 'ai' };
                setMessages(prev => [...prev, unsupportedMessage]);
                setSuggestions(initialSuggestions);
                setIsButtonOnly(true);
            }
        } else {
            const flow = conversationFlows[conversationState.templateType];
            if (flow) {
                const currentStepInfo = flow[conversationState.currentStep];
                const newInputs = { ...conversationState.inputs, [currentStepInfo.key]: text };
                
                // 최소 글자 수 규칙을 정의합니다.
                const minLengthRules: Record<string, number> = {
                    coreStrengths: 10,
                    description: 10, // 코드 스니펫의 설명
                    emailBody: 5,
                    topic: 5,
                };
                const minLength = minLengthRules[currentStepInfo.key] || 2;
        
                // 사용자가 짧은 답변을 입력했을 때의 처리
                if (text.trim().length < minLength && !suggestion && text.trim().toLowerCase() !== '없음') {
                    const lastAiMessage = messages.filter(m => m.sender === 'ai').pop();
                    let retryMessageText = `죄송하지만, ${minLength}자 이상 구체적으로 입력해주시겠어요?`;
        
                    // 이메일 본문(emailBody)을 작성하는 단계에서, 재차 짧은 답변을 했을 경우
                    if (currentStepInfo.key === 'emailBody' && lastAiMessage?.text.includes('구체적으로 입력')) {
                        retryMessageText = "알겠습니다. 다만 더 좋은 결과물을 위해, '몸이 좋지 않아 수업 참여가 어렵습니다.' 와 같이 상황을 조금만 더 자세히 풀어써 주시면 AI가 훨씬 멋진 이메일을 작성해 줄 거예요.";
                    }
                    
                    const askForDetailsMessage: Message = { id: getUniqueId(), text: retryMessageText, sender: 'ai' };
                    setMessages(prev => [...prev, askForDetailsMessage]);
                    setSuggestions(currentStepInfo.suggestions || []);
                    return; // 다음 단계로 넘어가지 않음
                }
        
                const nextStepIndex = conversationState.currentStep + 1;
                if (nextStepIndex < flow.length) {
                    const nextStep = flow[nextStepIndex];
                    const newAiMessage: Message = { id: getUniqueId(), text: nextStep.question, sender: 'ai' };
                    setMessages(prev => [...prev, newAiMessage]);
                    setSuggestions(nextStep.suggestions || []);
                    setIsButtonOnly(!!nextStep.isButtonOnly);
                    setConversationState(prev => ({ ...prev, currentStep: nextStepIndex, inputs: newInputs }));
                }
            }
        }
    };

    const handleCopyToClipboard = (text: string, messageId: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        }).catch(err => {
            console.error('클립보드 복사 실패:', err);
        });
    };

    return (
      <div className="bg-gray-50 text-gray-800 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl h-[90vh] max-h-[800px] bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
            <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white z-10 flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-800">Jium</h1>
                <button 
                    onClick={() => handleRestart(false)} 
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-200" 
                    aria-label="다시 시작"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <title>다시 시작</title>
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
                            <div className="flex justify-start pl-14 -mt-2">
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