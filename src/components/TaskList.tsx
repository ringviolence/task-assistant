import type { Task } from "@/lib/types";
import TaskCard from "./TaskCard";

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildHorizonConfig() {
  const now = new Date();
  const order: string[] = ["today", "tomorrow"];
  const labels: Record<string, string> = {
    today: "Today",
    tomorrow: "Tomorrow",
    soon: "Soon",
    later: "Later",
    someday: "Someday",
  };

  // Named days: offsets 2–6 from today
  for (let i = 2; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const name = DAY_NAMES[d.getDay()];
    labels[name] = `${capitalize(name)} (${MONTH_ABBR[d.getMonth()]} ${d.getDate()})`;
    order.push(name);
  }

  order.push("soon", "later", "someday");
  return { order, labels };
}

export default function TaskList({
  tasks,
  onReference,
}: {
  tasks: Task[];
  onReference?: (task: Task) => void;
}) {
  const { order, labels } = buildHorizonConfig();

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const grouped = order
    .map((horizon) => ({
      horizon,
      label: labels[horizon] ?? capitalize(horizon),
      tasks: activeTasks.filter((t) => t.time_horizon === horizon),
    }))
    .filter((g) => g.tasks.length > 0);

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-500">
        <p className="text-sm">No tasks yet</p>
        <p className="mt-1 text-xs">Chat with the assistant to add tasks</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-4">
      {grouped.map(({ horizon, label, tasks: groupTasks }) => (
        <div key={horizon}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </h2>
          <div className="flex flex-col gap-2">
            {groupTasks.map((task) => (
              <TaskCard key={task.id} task={task} onReference={onReference} />
            ))}
          </div>
        </div>
      ))}
      {doneTasks.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Completed
          </h2>
          <div className="flex flex-col gap-2">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} onReference={onReference} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
