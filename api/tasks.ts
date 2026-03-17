import { runTaskByType } from "../lib/task-service";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { type, payload } = req.body || {};
  if (!type) {
    res.status(400).json({ error: "缺少任务类型" });
    return;
  }

  try {
    const result = await runTaskByType(type, payload);
    res.status(200).json({
      taskId: `vercel-${Date.now()}`,
      status: "completed",
      result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "任务执行失败" });
  }
}
