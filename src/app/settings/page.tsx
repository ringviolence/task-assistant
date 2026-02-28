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
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-200">Settings</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          ← Back
        </Link>
      </div>
      <div className="mb-2">
        <p className="text-sm font-medium text-gray-300">User context</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Background about the user, injected into every system prompt.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={14}
            className="w-full resize-y rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 outline-none focus:border-blue-500"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>
            {saved && <span className="text-xs text-green-500">Saved</span>}
          </div>
        </>
      )}
    </div>
  );
}
