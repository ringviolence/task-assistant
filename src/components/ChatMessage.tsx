import type { ChatMessage as ChatMessageType } from "@/lib/types";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  const hasRefs =
    isUser &&
    ((message.referencedTasks?.length ?? 0) > 0 ||
      (message.referencedOutcomes?.length ?? 0) > 0);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {message.content}
        {hasRefs && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.referencedTasks?.map((t) => (
              <span
                key={t.id}
                className="max-w-[160px] truncate rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60"
              >
                {t.title}
              </span>
            ))}
            {message.referencedOutcomes?.map((o) => (
              <span
                key={o.id}
                className="max-w-[160px] truncate rounded px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: `${o.color}44`, color: o.color }}
              >
                {o.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
