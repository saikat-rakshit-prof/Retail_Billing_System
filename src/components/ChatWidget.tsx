'use client';

import React, {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
};

const QUICK_CHIPS = [
  { label: "Today's sales", prompt: "What are today's total sales?" },
  { label: 'Low stock items', prompt: 'Which items are low on stock?' },
  {
    label: 'Customers with due bills',
    prompt: 'Which customers have pending dues?',
  },
];

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "👋 Hello! I'm the **Shop Assistant** for Saikat Enterprise.\n\nAsk me anything about your sales, stock, or customer balances, or click a quick suggestion below.",
  timestamp: new Date(),
};

export function ChatWidget() {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const { data: _session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const toggleChat = () => {
    setIsOpen((prev) => {
      if (!prev) {
        setHasUnread(false);
        setTimeout(() => inputRef.current?.focus(), 250);
      }
      return !prev;
    });
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      // Send conversation history to /api/chat (excluding the static welcome note)
      const apiMessages = newMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.reply || '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (!isOpen) setHasUnread(true);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Sorry, I could not process your request. Please try again.';
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleChipClick = (prompt: string) => {
    sendMessage(prompt);
  };

  // Auto-scroll on message updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Hide on login page
  if (isLoginPage) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="chat-fab"
        onClick={toggleChat}
        className={`
          fixed z-[60] rounded-full shadow-lg
          transition-all duration-300 ease-out
          hover:shadow-xl hover:scale-105
          active:scale-95
          ${isOpen
            ? 'bg-slate-700 hover:bg-slate-800 bottom-6 right-6 w-12 h-12 lg:bottom-8 lg:right-8'
            : 'bg-primary hover:bg-primary/90 bottom-[88px] right-4 w-14 h-14 lg:bottom-8 lg:right-8 lg:w-14 lg:h-14'
          }
          flex items-center justify-center text-white
        `}
        style={{ minHeight: '48px', minWidth: '48px' }}
        aria-label={isOpen ? 'Close chat' : 'Open shop assistant'}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          id="chat-window"
          className={`
            fixed z-[59] bg-white rounded-2xl shadow-2xl
            flex flex-col overflow-hidden
            border border-slate-200/80
            /* Mobile: Near full-screen above bottom nav */
            inset-x-3 bottom-[84px] top-16
            /* Desktop: 380x520 floating window */
            lg:inset-auto lg:bottom-24 lg:right-8
            lg:w-[380px] lg:h-[520px]
            lg:rounded-2xl
          `}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary to-emerald-600 text-white flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight">
                Shop Assistant
              </h3>
              <p className="text-[11px] text-white/80 leading-tight">
                Saikat Enterprise
              </p>
            </div>
            <button
              onClick={toggleChat}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              style={{ minHeight: '32px', minWidth: '32px' }}
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages List */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/60"
            style={{ overscrollBehavior: 'contain' }}
          >
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2.5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 ml-1">Thinking…</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {messages.filter((m) => m.role === 'user').length < 2 && !isLoading && (
            <div className="px-3 py-2 flex gap-1.5 overflow-x-auto flex-shrink-0 bg-white border-t border-slate-100 no-scrollbar">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleChipClick(chip.prompt)}
                  className="flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full
                    bg-primary/10 text-primary border border-primary/20
                    hover:bg-primary/20 hover:border-primary/30
                    transition-colors whitespace-nowrap"
                  style={{ minHeight: '28px', minWidth: 'auto' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Input + Send Area */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-2.5 bg-white border-t border-slate-200 flex-shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about sales, stock, dues..."
              disabled={isLoading}
              className="flex-1 bg-slate-100 rounded-xl px-3.5 py-2 text-sm
                placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white
                border border-transparent focus:border-primary/20
                transition-all disabled:opacity-50"
              style={{ fontSize: '15px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center
                hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed
                transition-all active:scale-95 flex-shrink-0"
              style={{ minHeight: '36px', minWidth: '36px' }}
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}

      {/* Scoped markdown styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        #chat-window table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; }
        #chat-window th, #chat-window td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; }
        #chat-window th { background: #f1f5f9; font-weight: 600; font-size: 11px; color: #475569; }
        #chat-window tr:nth-child(even) { background: #f8fafc; }
        #chat-window ul, #chat-window ol { padding-left: 16px; margin: 4px 0; }
        #chat-window li { margin: 2px 0; }
        #chat-window p { margin: 3px 0; }
        #chat-window strong { font-weight: 600; }
        #chat-window code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; font-size: 12px; }
      `}} />
    </>
  );
}

/**
 * Chat Message Bubble
 */
function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-slate-700 text-white'
            : message.isError
            ? 'bg-red-100'
            : 'bg-primary/10'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : message.isError ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-primary" />
        )}
      </div>

      {/* Bubble Content */}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
          isUser
            ? 'bg-primary text-white rounded-tr-sm'
            : message.isError
            ? 'bg-red-50 text-red-700 rounded-tl-sm border border-red-100'
            : 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <p
          className={`text-[10px] mt-1 ${
            isUser ? 'text-white/60' : 'text-slate-400'
          }`}
        >
          {message.timestamp.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
