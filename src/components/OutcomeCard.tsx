"use client";

import { useState } from "react";
import type { OutcomeWithTasks } from "@/lib/types";

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

  const bg = `${outcome.color}22`;
  const border = `${outcome.color}55`;

  return (
    <div
      className={`rounded-lg border p-3 ${outcome.status === "done" ? "opacity-60" : ""}`}
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-100 flex-1 min-w-0">
          {outcome.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {outcome.status === "done" && (
            <span className="text-xs text-green-600">done</span>
          )}
          {onReference && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onReference(outcome)}
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
      {expanded && outcome.definition_of_done && (
        <p className="mt-1 text-xs text-gray-400">
          Done when: {outcome.definition_of_done}
        </p>
      )}
      {expanded && outcome.description && (
        <p className="mt-1 text-xs text-gray-400">{outcome.description}</p>
      )}
      {expanded && outcome.tasks.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {outcome.tasks.map((task) => (
            <div
              key={task.id}
              className="border-l border-gray-700 pl-2 text-xs text-gray-400"
            >
              {task.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
