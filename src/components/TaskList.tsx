import type { Task } from "@/lib/types";
import TaskCard from "./TaskCard";

const HORIZON_ORDER: Task["time_horizon"][] = [
  "today",
  "this_week",
  "this_month",
  "later",
  "someday",
];

const HORIZON_LABELS: Record<Task["time_horizon"], string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  later: "Later",
  someday: "Someday",
};

export default function TaskList({ tasks }: { tasks: Task[] }) {
  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const grouped = HORIZON_ORDER.map((horizon) => ({
    horizon,
    label: HORIZON_LABELS[horizon],
    tasks: activeTasks.filter((t) => t.time_horizon === horizon),
  })).filter((g) => g.tasks.length > 0);

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
              <TaskCard key={task.id} task={task} />
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
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
