export type TaskType = "ideas" | "generate-posters" | "optimize-existing" | "optimize-poster" | "proposal";

type TaskStatus = "queued" | "running" | "completed" | "failed";

type TaskResponse<T> = {
  id: string;
  type: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  result?: T;
  error?: string;
};

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

export async function createTask<TPayload>(type: TaskType, payload: TPayload) {
  return request<{ taskId: string; status?: TaskStatus; result?: unknown }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });
}

export async function getTask<TResult>(taskId: string) {
  return request<TaskResponse<TResult>>(`/api/tasks/${taskId}`);
}

export async function runTask<TPayload, TResult>(
  type: TaskType,
  payload: TPayload,
  options?: {
    intervalMs?: number;
    onStatusChange?: (status: TaskStatus) => void;
  },
) {
  const created = await createTask(type, payload);
  if (created.status === "completed") {
    options?.onStatusChange?.("completed");
    return created.result as TResult;
  }

  const { taskId } = created;
  const intervalMs = options?.intervalMs ?? 1500;

  while (true) {
    const task = await getTask<TResult>(taskId);
    options?.onStatusChange?.(task.status);

    if (task.status === "completed") {
      return task.result as TResult;
    }
    if (task.status === "failed") {
      throw new Error(task.error || "任务执行失败");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
