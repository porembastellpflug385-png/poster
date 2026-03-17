import "dotenv/config";
import express from "express";
import { getServiceConfig, runTaskByType } from "./lib/task-service";

const app = express();
const port = Number(process.env.PORT || 3001);
const tasks = new Map<string, any>();

app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json(getServiceConfig());
});

app.post("/api/tasks", async (req, res) => {
  const { type, payload } = req.body || {};
  if (!type) {
    res.status(400).json({ error: "缺少任务类型" });
    return;
  }

  const taskId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  tasks.set(taskId, {
    id: taskId,
    type,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  queueMicrotask(async () => {
    tasks.set(taskId, { ...tasks.get(taskId), status: "running", updatedAt: Date.now() });
    try {
      const result = await runTaskByType(type, payload);
      tasks.set(taskId, { ...tasks.get(taskId), status: "completed", result, updatedAt: Date.now() });
    } catch (error: any) {
      tasks.set(taskId, {
        ...tasks.get(taskId),
        status: "failed",
        error: error.message || "任务执行失败",
        updatedAt: Date.now(),
      });
    }
  });

  res.status(202).json({ taskId });
});

app.get("/api/tasks/:taskId", (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).json({ error: "任务不存在" });
    return;
  }
  res.json(task);
});

app.listen(port, () => {
  console.log(`poster-project api listening on http://localhost:${port}`);
});
