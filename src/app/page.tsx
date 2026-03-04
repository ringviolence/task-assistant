"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import type {
  ChatMessage,
  Task,
  OutcomeWithTasks,
  ChatResponse,
  TasksResponse,
  OutcomesResponse,
  MaintenanceResult,
} from "@/lib/types";
import ChatPanel, { type ChatPanelHandle } from "@/components/ChatPanel";
import TaskList from "@/components/TaskList";
import OutcomeList from "@/components/OutcomeList";
import SelectionReply from "@/components/SelectionReply";
import SearchOverlay from "@/components/SearchOverlay";

type MaintenanceStatus =
  | null
  | { shifted: number; overdue: number; duplicates: MaintenanceResult["duplicates"] };

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeWithTasks[]>([]);
  const [loading, setLoading] = useState(false);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(null);
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const [referencedTasks, setReferencedTasks] = useState<Task[]>([]);
  const [referencedOutcomes, setReferencedOutcomes] = useState<OutcomeWithTasks[]>([]);
  const [activeTab, setActiveTab] = useState<"tasks" | "outcomes">("tasks");
  const [searchOpen, setSearchOpen] = useState(false);
  const chatPanelRef = useRef<ChatPanelHandle>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: TasksResponse) => setTasks(data.tasks))
      .catch(console.error);
    fetch("/api/outcomes")
      .then((r) => r.json())
      .then((data: OutcomesResponse) => setOutcomes(data.outcomes))
      .catch(console.error);
  }, []);

  const outcomeColors = useMemo(
    () => Object.fromEntries(outcomes.map((o) => [o.id, o.color])),
    [outcomes]
  );

  const handleAddReference = useCallback((task: Task) => {
    setReferencedTasks((prev) =>
      prev.some((t) => t.id === task.id) ? prev : [...prev, task]
    );
  }, []);

  const handleRemoveReference = useCallback((id: number) => {
    setReferencedTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAddOutcomeReference = useCallback((outcome: OutcomeWithTasks) => {
    setReferencedOutcomes((prev) =>
      prev.some((o) => o.id === outcome.id) ? prev : [...prev, outcome]
    );
  }, []);

  const handleRemoveOutcomeReference = useCallback((id: number) => {
    setReferencedOutcomes((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const handleEndDiscussion = useCallback(() => {
    setReferencedTasks([]);
    setReferencedOutcomes([]);
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      const refs = referencedTasks;
      const outcomeRefs = referencedOutcomes;
      const isDiscussion = outcomeRefs.length > 0;

      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        referencedTasks: refs.length > 0 ? refs : undefined,
        referencedOutcomes: outcomeRefs.length > 0 ? outcomeRefs : undefined,
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      if (!isDiscussion) {
        setReferencedTasks([]);
        setReferencedOutcomes([]);
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: messages,
            referencedTasks: refs,
            referencedOutcomes: outcomeRefs,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? `API error: ${res.status}`);
        }
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setTasks((data as ChatResponse).tasks);
        setOutcomes((data as ChatResponse).outcomes);
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: error instanceof Error
            ? `Error: ${error.message}`
            : "Sorry, something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [messages, referencedTasks, referencedOutcomes]
  );

  const handleMaintenance = useCallback(async () => {
    setMaintenanceRunning(true);
    setMaintenanceStatus(null);
    try {
      const res = await fetch("/api/maintenance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Maintenance failed");
      setTasks(data.tasks);
      setMaintenanceStatus({
        shifted: data.shifted,
        overdue: data.overdue,
        duplicates: data.duplicates,
      });
      setTimeout(() => setMaintenanceStatus(null), 6000);
    } catch (error) {
      console.error("Maintenance error:", error);
    } finally {
      setMaintenanceRunning(false);
    }
  }, []);

  // When the search overlay closes, return focus to the chat input.
  // This covers the case where the overlay's own input had focus and the
  // overlay unmounts, which would otherwise leave focus on document.body.
  useEffect(() => {
    if (!searchOpen) chatPanelRef.current?.focusInput();
  }, [searchOpen]);

  const handleQuoteConsumed = useCallback(() => setQuotedText(null), []);

  return (
    <div className="flex h-screen bg-white">
      <SelectionReply onReply={setQuotedText} />
      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onReference={handleAddReference}
          outcomeColors={outcomeColors}
        />
      )}

      {/* Left: chat panel */}
      <div className="flex-1 border-r border-gray-200">
        <ChatPanel
          ref={chatPanelRef}
          messages={messages}
          onSend={handleSend}
          loading={loading}
          quotedText={quotedText}
          onQuoteConsumed={handleQuoteConsumed}
          referencedTasks={referencedTasks}
          onRemoveReference={handleRemoveReference}
          referencedOutcomes={referencedOutcomes}
          onRemoveOutcomeReference={handleRemoveOutcomeReference}
          onEndDiscussion={handleEndDiscussion}
        />
      </div>

      {/* Right: tasks / outcomes panel — any click here returns focus to the chat input */}
      <div className="w-[35%] flex flex-col border-l border-gray-200 bg-white" onMouseDown={() => chatPanelRef.current?.focusInput()}>
        {/* Tab bar */}
        <div className="border-b border-gray-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`py-3 pr-4 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "tasks"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab("outcomes")}
              className={`py-3 pr-4 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "outcomes"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              Outcomes
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              title="Search tasks (⌘K)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="4" />
                <path d="M9 9L12 12" />
              </svg>
            </button>
            <button
              onClick={handleMaintenance}
              disabled={maintenanceRunning}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors"
            >
              {maintenanceRunning ? "Running…" : "Daily shift"}
            </button>
            <Link
              href="/settings"
              className="text-gray-400 hover:text-gray-700 transition-colors text-sm"
              title="Settings"
            >
              ⚙
            </Link>
          </div>
        </div>

        {/* Maintenance status */}
        {maintenanceStatus && (
          <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500 shrink-0">
            {maintenanceStatus.shifted > 0 || maintenanceStatus.overdue > 0 ? (
              <>
                Shifted {maintenanceStatus.shifted} task{maintenanceStatus.shifted !== 1 ? "s" : ""} to today
                {maintenanceStatus.overdue > 0 && (
                  <>, {maintenanceStatus.overdue} overdue</>
                )}
              </>
            ) : (
              "Nothing to shift"
            )}
            {maintenanceStatus.duplicates.length > 0 && (
              <span className="ml-2 text-amber-600">
                · {maintenanceStatus.duplicates.length} possible duplicate{maintenanceStatus.duplicates.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "tasks" ? (
            <TaskList
              tasks={tasks}
              outcomeColors={outcomeColors}
              onReference={handleAddReference}
            />
          ) : (
            <OutcomeList
              outcomes={outcomes}
              onReference={handleAddOutcomeReference}
            />
          )}
        </div>
      </div>
    </div>
  );
}
