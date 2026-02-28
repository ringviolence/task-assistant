"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 7H3M6 4L3 7L6 10" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5L7 9L11 5" />
    </svg>
  );
}

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
  const isDone = task.status === "done";

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white ${isDone ? "opacity-60" : ""}`}
      style={outcomeColor ? { backgroundColor: `${outcomeColor}33` } : undefined}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Left: reference button */}
        <div className="w-7 shrink-0">
          {onReference && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onReference(task)}
              className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 transition-colors"
              title="Reference in chat"
            >
              <ArrowLeftIcon />
            </button>
          )}
        </div>

        {/* Center: title */}
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm leading-snug ${
              isDone ? "line-through text-gray-400" : "text-gray-800"
            }`}
          >
            {task.title}
          </span>
          {task.status === "waiting" && (
            <span className="ml-2 text-xs text-amber-600">waiting</span>
          )}
        </div>

        {/* Right: expand button */}
        <div className="w-7 shrink-0">
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 transition-colors"
              style={{
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
              title={expanded ? "Collapse" : "Expand"}
            >
              <ChevronDownIcon />
            </button>
          )}
        </div>
      </div>

      {expanded && (task.description || task.tags.length > 0) && (
        <div className="px-4 pb-3 pt-0">
          {task.description && (
            <p className="text-xs text-gray-500">{task.description}</p>
          )}
          {task.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
