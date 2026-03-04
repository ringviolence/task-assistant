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
  source: string;
  source_url: string | null;
  outcome_id: number | null;
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
  source: string;
  outcome_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Outcome {
  id: number;
  title: string;
  definition_of_done: string | null;
  description: string | null;
  color: string;
  status: "active" | "done";
  created_at: string;
  updated_at: string;
}

export interface OutcomeWithTasks extends Outcome {
  tasks: Task[];
}

export type TaskOperationType =
  | "add"
  | "update"
  | "complete"
  | "delete"
  | "create_outcome"
  | "update_outcome"
  | "close_outcome"
  | "delete_outcome"
  | "link_task"
  | "unlink_task";

export interface TaskOperation {
  op: TaskOperationType;
  // shared id (task id for task ops; outcome id for outcome ops)
  id?: number;
  // task fields
  title?: string;
  description?: string | null;
  tags?: string[];
  time_horizon?: TimeHorizon;
  status?: Task["status"];
  outcome_id?: number | null | "new";
  source_url?: string | null;
  // outcome-specific fields
  definition_of_done?: string | null;
  // link / unlink
  task_id?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  referencedTasks?: Task[];
  referencedOutcomes?: OutcomeWithTasks[];
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  referencedTasks?: Task[];
  referencedOutcomes?: OutcomeWithTasks[];
}

export interface ChatResponse {
  reply: string;
  tasks: Task[];
  outcomes: OutcomeWithTasks[];
}

export interface TasksResponse {
  tasks: Task[];
}

export interface OutcomesResponse {
  outcomes: OutcomeWithTasks[];
}

export interface MaintenanceResult {
  shifted: number;
  overdue: number;
  duplicates: Array<{ id1: number; title1: string; id2: number; title2: string }>;
}
