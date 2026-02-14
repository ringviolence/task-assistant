"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, Task, ChatResponse, TasksResponse } from "@/lib/types";
import ChatPanel from "@/components/ChatPanel";
import TaskList from "@/components/TaskList";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

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

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data: ChatResponse = await res.json();
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setTasks(data.tasks);
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [messages]
  );

  return (
    <div className="flex h-screen">
      <div className="flex-1 border-r border-gray-800">
        <ChatPanel messages={messages} onSend={handleSend} loading={loading} />
      </div>
      <div className="w-96 overflow-y-auto border-l border-gray-800">
        <div className="border-b border-gray-800 px-4 py-3">
          <h1 className="text-sm font-semibold text-gray-300">Tasks</h1>
        </div>
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
}
