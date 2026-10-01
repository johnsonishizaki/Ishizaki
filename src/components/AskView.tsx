import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, BookOpen, FileText, CornerDownLeft, RefreshCw } from 'lucide-react';
import { askAI } from '../lib/aiClient';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  timestamp: string;
}

interface AskViewProps {
  initialPrompt?: string;
  documentContext?: { title: string; text: string } | null;
  onClearContext?: () => void;
}

export const AskView: React.FC<AskViewProps> = ({
  initialPrompt = '',
  documentContext,
  onClearContext,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am Ishizaki, your academic operating engine. 

I know your curriculum across all 9 disciplines for WASSCE and the Digital SAT. Tell me what you'd like to understand, say **"Teach me [topic] from zero"**, or paste a problem you're stuck on.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let promptWithContext = query;
      if (documentContext) {
        promptWithContext = `[Context from Student Document "${documentContext.title}"]:\n${documentContext.text}\n\n[Student Question]:\n${query}`;
      }

      const res = await askAI({
        prompt: promptWithContext,
        systemInstruction: `You are Ishizaki, a world-class academic tutor and cognitive engine for a high school student preparing for Ghanaian WASSCE and the Digital SAT (2028).
Guidelines:
1. When asked to "teach from zero", identify missing prerequisites, build from foundational intuition, provide a clean worked example, and end with a quick check question.
2. For Math/Physics/Chemistry: Show clear algebraic steps and state the governing theorem/law.
3. Help the student become independently capable. Do not simply give away full solutions when a hint or guiding question would better build mastery.
4. Keep explanations rigorous, clear, and scholarly. Avoid generic conversational fluff.`,
        preferredTier: 'heavy',
      });

      const assistantMsg: Message = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: res.text,
        provider: res.provider,
        model: res.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `Unable to complete response: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 py-4 sm:px-6">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
        <div>
          <h1 className="font-serif text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Ishizaki Tutor
          </h1>
          <p className="text-xs text-stone-500">
            Unified AI learning engine · WASSCE & SAT academic grounding
          </p>
        </div>

        {documentContext && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-medium truncate max-w-xs">{documentContext.title}</span>
            {onClearContext && (
              <button onClick={onClearContext} className="ml-1 text-blue-500 hover:text-blue-700">
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 space-y-5 overflow-y-auto py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'border border-stone-200 bg-white text-stone-800 shadow-xs dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 font-serif'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <div className="whitespace-pre-wrap font-sans text-sm">{msg.content}</div>
              )}

              {msg.provider && (
                <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 text-[10px] text-stone-600 dark:border-stone-800 dark:text-stone-400 font-sans">
                  <span>Provider: {msg.provider} ({msg.model})</span>
                  <span>{msg.timestamp}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-stone-500 font-sans">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
            <span>Ishizaki is synthesizing academic reasoning...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {[
            'Teach me Surds & Logarithms from zero',
            'Explain Differentiation from first principles',
            'Break down Newton’s Third Law with common WASSCE misconceptions',
            'How is the digital SAT Math module adaptive format scored?',
          ].map((promptText) => (
            <button
              key={promptText}
              onClick={() => handleSend(promptText)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600 hover:border-stone-400 hover:text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            >
              {promptText}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="relative pt-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question, paste a problem, or request an explanation..."
          className="w-full resize-none rounded-xl border border-stone-300 bg-white p-3 pr-12 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        />

        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="absolute bottom-5 right-3 rounded-lg bg-stone-900 p-2 text-white transition-opacity hover:opacity-90 disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
