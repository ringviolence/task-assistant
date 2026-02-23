export type TimeHorizon =
  | "today"
  | "tomorrow"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"
  | "soon"
  | "later"
  | "someday";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  tags: string[];
  time_horizon: TimeHorizon;
  status: "active" | "done" | "waiting";
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  tags: string; // JSON string
  time_horizon: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type TaskOperationType = "add" | "update" | "complete" | "delete" | "set_goals";

export interface TaskOperation {
  op: TaskOperationType;
  id?: number;
  title?: string;
  description?: string;
  tags?: string[];
  time_horizon?: TimeHorizon;
  status?: Task["status"];
  level?: "right_now" | "weekly" | "quarterly";
  content?: string;
}

export interface Goals {
  right_now: string;
  weekly: string;
  quarterly: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  tasks: Task[];
}

export interface TasksResponse {
  tasks: Task[];
}

export interface MaintenanceResult {
  shifted: number;
  overdue: number;
  duplicates: Array<{ id1: number; title1: string; id2: number; title2: string }>;
}
