"use client";

import { useState, useEffect, useRef } from "react";
import type { Task } from "@/lib/types";
import TaskCard from "./TaskCard";

interface SearchOverlayProps {
  onClose: () => void;
  onReference: (task: Task) => void;
  outcomeColors: Record<number, string>;
}

export default function SearchOverlay({ onClose, onReference, outcomeColors }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleReference(task: Task) {
    onReference(task);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 border-b border-gray-200 px-4 py-3"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Searching…</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">No matching tasks found</div>
        )}

        {!loading && results.length > 0 && (
          <div className="flex flex-col gap-1.5 overflow-y-auto p-4" style={{ maxHeight: "60vh" }}>
            {results.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                outcomeColor={task.outcome_id ? outcomeColors[task.outcome_id] : undefined}
                onReference={handleReference}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
