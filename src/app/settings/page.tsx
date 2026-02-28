"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setContext(data.userContext ?? "");
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  async function handleSave() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userContext: context }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <div className="mb-2">
          <p className="text-sm font-medium text-gray-700">User context</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Background about the user, injected into every system prompt.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={14}
              className="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-500"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleSave}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Save
              </button>
              {saved && <span className="text-xs text-gray-500">Saved</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
