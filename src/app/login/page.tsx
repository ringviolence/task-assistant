"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-72">
        <h1 className="text-gray-300 text-sm font-semibold text-center">
          Task Assistant
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-500"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-100 text-sm rounded px-3 py-2 transition-colors cursor-pointer disabled:cursor-default"
        >
          {loading ? "..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
