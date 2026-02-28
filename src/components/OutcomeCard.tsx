"use client";

import { useState } from "react";
import type { OutcomeWithTasks } from "@/lib/types";

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

export default function OutcomeCard({
  outcome,
  onReference,
}: {
  outcome: OutcomeWithTasks;
  onReference?: (outcome: OutcomeWithTasks) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    outcome.definition_of_done || outcome.description || outcome.tasks.length > 0;

  const bg = `${outcome.color}44`;
  const border = `${outcome.color}88`;
  const btnBorder = `${outcome.color}66`;

  return (
    <div
      className={`rounded-lg border ${outcome.status === "done" ? "opacity-60" : ""}`}
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Left: reference button */}
        <div className="w-7 shrink-0">
          {onReference && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onReference(outcome)}
              className="flex h-7 w-7 items-center justify-center rounded border text-gray-500 hover:text-gray-800 transition-colors"
              style={{ borderColor: btnBorder }}
              title="Reference in chat"
            >
              <ArrowLeftIcon />
            </button>
          )}
        </div>

        {/* Center: title */}
        <div className="flex-1 min-w-0">
          <span className="text-sm leading-snug text-gray-800">{outcome.title}</span>
          {outcome.status === "done" && (
            <span className="ml-2 text-xs text-gray-400">done</span>
          )}
        </div>

        {/* Right: expand button */}
        <div className="w-7 shrink-0">
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded border text-gray-500 hover:text-gray-800 transition-colors"
              style={{
                borderColor: btnBorder,
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

      {expanded && (
        <div className="px-4 pb-3 pt-0">
          {outcome.definition_of_done && (
            <p className="text-xs text-gray-600">
              Done when: {outcome.definition_of_done}
            </p>
          )}
          {outcome.description && (
            <p className="mt-1 text-xs text-gray-600">{outcome.description}</p>
          )}
          {outcome.tasks.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {outcome.tasks.map((task) => (
                <div
                  key={task.id}
                  className="border-l-2 pl-2 text-xs text-gray-600"
                  style={{ borderColor: `${outcome.color}88` }}
                >
                  {task.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
