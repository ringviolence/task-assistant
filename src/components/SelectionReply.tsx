"use client";

import { useEffect, useState, useCallback } from "react";

interface SelectionReplyProps {
  onReply: (text: string) => void;
}

interface Tooltip {
  x: number;
  y: number;
  text: string;
}

export default function SelectionReply({ onReply }: SelectionReplyProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    let node: Node | null = selection.anchorNode;
    while (node) {
      if (
        node instanceof HTMLElement &&
        (node.tagName === "TEXTAREA" || node.tagName === "INPUT")
      ) {
        return;
      }
      node = node.parentNode;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      text,
    });
  }, []);

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setTooltip(null);
      }
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleMouseUp]);

  if (!tooltip) return null;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-none"
      style={{ left: tooltip.x, top: tooltip.y - 6 }}
    >
      <button
        className="pointer-events-auto rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 shadow-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onReply(tooltip.text);
          setTooltip(null);
          window.getSelection()?.removeAllRanges();
        }}
      >
        Reply
      </button>
    </div>
  );
}
