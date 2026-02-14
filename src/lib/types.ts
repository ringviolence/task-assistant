export interface Task {
  id: number;
  title: string;
  description: string | null;
  tags: string[];
  time_horizon: "today" | "this_week" | "this_month" | "later" | "someday";
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

export type TaskOperationType = "add" | "update" | "complete" | "delete";

export interface TaskOperation {
  op: TaskOperationType;
  id?: number;
  title?: string;
  description?: string;
  tags?: string[];
  time_horizon?: Task["time_horizon"];
  status?: Task["status"];
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
