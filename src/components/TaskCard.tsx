"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";

const statusStyles: Record<Task["status"], string> = {
  active: "border-gray-700 bg-gray-900",
  done: "border-gray-800 bg-gray-900/50 opacity-60",
  waiting: "border-yellow-900 bg-gray-900",
};

export default function TaskCard({
  task,
  outcomeColor,
  onReference,
}: {
  task: Task;
  outcomeColor?: string;
  onReference?: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = task.description || task.tags.length > 0;

  return (
    <div
      className={`rounded-lg border p-3 ${statusStyles[task.status]}`}
      style={outcomeColor ? { backgroundColor: `${outcomeColor}22` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`text-sm font-medium flex-1 min-w-0 ${task.status === "done" ? "line-through text-gray-500" : "text-gray-100"}`}
        >
          {task.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {task.status === "waiting" && (
            <span className="text-xs text-yellow-500">waiting</span>
          )}
          {task.status === "done" && (
            <span className="text-xs text-green-600">done</span>
          )}
          {onReference && (
            <button
              onClick={() => onReference(task)}
              className="text-gray-600 hover:text-gray-300 text-xs leading-none"
              title="Reference in chat"
            >
              @
            </button>
          )}
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-gray-600 hover:text-gray-400 text-sm leading-none"
              title={expanded ? "Collapse" : "Expand"}
            >
              ···
            </button>
          )}
        </div>
      </div>
      {expanded && task.description && (
        <p className="mt-1 text-xs text-gray-400">{task.description}</p>
      )}
      {expanded && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
