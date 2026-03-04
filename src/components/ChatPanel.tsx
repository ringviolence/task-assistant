"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { ChatMessage as ChatMessageType, Task, OutcomeWithTasks } from "@/lib/types";
import ChatMessage from "./ChatMessage";

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSend: (message: string) => void;
  loading: boolean;
  quotedText: string | null;
  onQuoteConsumed: () => void;
  referencedTasks: Task[];
  onRemoveReference: (id: number) => void;
  referencedOutcomes: OutcomeWithTasks[];
  onRemoveOutcomeReference: (id: number) => void;
  onEndDiscussion: () => void;
}

export interface ChatPanelHandle {
  focusInput: () => void;
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({
  messages,
  onSend,
  loading,
  quotedText,
  onQuoteConsumed,
  referencedTasks,
  onRemoveReference,
  referencedOutcomes,
  onRemoveOutcomeReference,
  onEndDiscussion,
}, ref) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    if (!quotedText) return;
    const ta = inputRef.current;
    if (!ta) return;
    const lines = quotedText.split("\n");
    const quote = lines.map((line) => `> ${line}`).join("\n") + "\n\n";
    const existing = ta.value;
    ta.value = quote + existing;
    autoResize();
    ta.focus();
    ta.setSelectionRange(quote.length, quote.length);
    onQuoteConsumed();
  }, [quotedText, onQuoteConsumed]);

  function autoResize() {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = inputRef.current;
    if (!input || !input.value.trim() || loading) return;
    onSend(input.value.trim());
    input.value = "";
    input.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      inputRef.current?.form?.requestSubmit();
    }
  }

  const hasChips = referencedTasks.length > 0 || referencedOutcomes.length > 0;
  const isDiscussionMode = referencedOutcomes.length > 0;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <p className="text-sm">What are you working on?</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        {hasChips && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {referencedTasks.map((task) => (
              <span
                key={`task-${task.id}`}
                className="flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                <span className="max-w-[180px] truncate">{task.title}</span>
                {!isDiscussionMode && (
                  <button
                    type="button"
                    onClick={() => onRemoveReference(task.id)}
                    className="ml-0.5 leading-none text-gray-400 hover:text-gray-700"
                    aria-label="Remove reference"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {referencedOutcomes.map((outcome) => (
              <span
                key={`outcome-${outcome.id}`}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                style={{
                  backgroundColor: `${outcome.color}33`,
                  borderColor: `${outcome.color}77`,
                  color: outcome.color,
                }}
              >
                <span className="max-w-[180px] truncate">{outcome.title}</span>
              </span>
            ))}
            {isDiscussionMode && (
              <button
                type="button"
                onClick={onEndDiscussion}
                className="ml-auto shrink-0 text-xs text-gray-400 hover:text-gray-700"
              >
                ✕ End discussion
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            autoFocus
            placeholder="Type a message..."
            disabled={loading}
            onInput={autoResize}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-500 disabled:opacity-50"
            style={{ maxHeight: "50vh" }}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
});

export default ChatPanel;
