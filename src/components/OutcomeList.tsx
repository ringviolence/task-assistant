import type { OutcomeWithTasks } from "@/lib/types";
import OutcomeCard from "./OutcomeCard";

export default function OutcomeList({
  outcomes,
  onReference,
}: {
  outcomes: OutcomeWithTasks[];
  onReference?: (outcome: OutcomeWithTasks) => void;
}) {
  const active = outcomes.filter((o) => o.status === "active");
  const done = outcomes.filter((o) => o.status === "done");

  if (outcomes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-400">
        <p className="text-sm">No outcomes yet</p>
        <p className="mt-1 text-xs">Ask the assistant to create an outcome</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {active.map((o) => (
        <OutcomeCard key={o.id} outcome={o} onReference={onReference} />
      ))}
      {done.length > 0 && (
        <>
          <h2 className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Completed
          </h2>
          {done.map((o) => (
            <OutcomeCard key={o.id} outcome={o} onReference={onReference} />
          ))}
        </>
      )}
    </div>
  );
}
