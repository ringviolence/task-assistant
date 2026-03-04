"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Prompt } from "@/lib/types";

export default function SettingsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setPrompts(data.prompts ?? []);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  function toggleExpand(key: string) {
    if (expandedKey === key) {
      setExpandedKey(null);
      if (editingKey === key) cancelEdit();
    } else {
      setExpandedKey(key);
    }
  }

  function startEdit(prompt: Prompt) {
    setEditingKey(prompt.key);
    setEditValue(prompt.value);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue("");
  }

  async function saveEdit(key: string) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: editValue }),
    });
    setPrompts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, value: editValue } : p))
    );
    setEditingKey(null);
    setEditValue("");
    setSaving(false);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  function unlock(key: string) {
    setUnlockedKeys((prev) => new Set([...prev, key]));
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-800">Settings</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700">
            ← Back
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {prompts.map((prompt) => {
              const isExpanded = expandedKey === prompt.key;
              const isEditing = editingKey === prompt.key;
              const canEdit =
                prompt.sensitivity !== "system" || unlockedKeys.has(prompt.key);

              return (
                <div key={prompt.key}>
                  {/* Header row */}
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(prompt.key)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {prompt.label}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {prompt.sensitivity}
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs ml-2 shrink-0">
                      {isExpanded ? "▴" : "▾"}
                    </span>
                  </button>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mt-2 mb-3">
                        {prompt.description}
                      </p>

                      {isEditing ? (
                        <>
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={12}
                            className="w-full resize-y rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 font-mono outline-none focus:border-gray-500"
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(prompt.key)}
                              disabled={saving}
                              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <pre className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 font-mono whitespace-pre-wrap break-words overflow-auto max-h-64">
                            {prompt.value || <span className="text-gray-400 italic">empty</span>}
                          </pre>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(prompt.value)
                              }
                              className="rounded px-3 py-1.5 text-xs text-gray-500 border border-gray-200 hover:text-gray-800 hover:border-gray-400"
                            >
                              Copy
                            </button>
                            {!canEdit ? (
                              <button
                                onClick={() => unlock(prompt.key)}
                                className="rounded px-3 py-1.5 text-xs text-gray-500 border border-gray-200 hover:text-gray-800 hover:border-gray-400"
                              >
                                Unlock editing
                              </button>
                            ) : (
                              <button
                                onClick={() => startEdit(prompt)}
                                className="rounded px-3 py-1.5 text-xs text-gray-500 border border-gray-200 hover:text-gray-800 hover:border-gray-400"
                              >
                                Edit
                              </button>
                            )}
                            {savedKey === prompt.key && (
                              <span className="text-xs text-gray-400 ml-1">
                                Saved ✓
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
