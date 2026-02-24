"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, Task, ChatResponse, TasksResponse, MaintenanceResult } from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";
import TaskList from "@/components/TaskList";
import SelectionReply from "@/components/SelectionReply";

type MaintenanceStatus =
  | null
  | { shifted: number; overdue: number; duplicates: MaintenanceResult["duplicates"] };

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(null);
  const [quotedText, setQuotedText] = useState<string | null>(null);

  // Load tasks on mount
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: TasksResponse) => setTasks(data.tasks))
      .catch(console.error);
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      const userMessage: ChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: messages,
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
    [messages]
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
      // Clear status after 6 seconds
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
        />
      </div>
      <div className="w-[35%] overflow-y-auto border-l border-gray-800">
        <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-300">Tasks</h1>
          <button
            onClick={handleMaintenance}
            disabled={maintenanceRunning}
            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
          >
            {maintenanceRunning ? "Running…" : "Daily shift"}
          </button>
        </div>
        {maintenanceStatus && (
          <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
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
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
}
