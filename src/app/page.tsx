"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import ChatPanel from "@/components/ChatPanel";
import TaskList from "@/components/TaskList";
import OutcomeList from "@/components/OutcomeList";
import SelectionReply from "@/components/SelectionReply";

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

  // Load tasks and outcomes on mount
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

  // Map of outcomeId -> color for task row tinting
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

  const handleSend = useCallback(
    async (message: string) => {
      const userMessage: ChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      const refs = referencedTasks;
      const outcomeRefs = referencedOutcomes;
      setReferencedTasks([]);
      setReferencedOutcomes([]);

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

  const handleQuoteConsumed = useCallback(() => setQuotedText(null), []);

  return (
    <div className="flex h-screen">
      <SelectionReply onReply={setQuotedText} />
      <div className="flex-1 border-r border-gray-800">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          loading={loading}
          quotedText={quotedText}
          onQuoteConsumed={handleQuoteConsumed}
          referencedTasks={referencedTasks}
          onRemoveReference={handleRemoveReference}
          referencedOutcomes={referencedOutcomes}
          onRemoveOutcomeReference={handleRemoveOutcomeReference}
        />
      </div>
      <div className="w-[35%] flex flex-col border-l border-gray-800">
        {/* Header with tabs and actions */}
        <div className="border-b border-gray-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`py-3 pr-4 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "tasks"
                  ? "border-gray-300 text-gray-200"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab("outcomes")}
              className={`py-3 pr-4 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "outcomes"
                  ? "border-gray-300 text-gray-200"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              Outcomes
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMaintenance}
              disabled={maintenanceRunning}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
            >
              {maintenanceRunning ? "Running…" : "Daily shift"}
            </button>
            <Link
              href="/settings"
              className="text-gray-600 hover:text-gray-300 transition-colors"
              title="Settings"
            >
              ⚙
            </Link>
          </div>
        </div>
        {/* Maintenance status banner */}
        {maintenanceStatus && (
          <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-400 shrink-0">
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
              <span className="ml-2 text-yellow-600">
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
