export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "请求体不是有效的 JSON" });
      return;
    }
  }

  const { type, payload } = body || {};
  if (!type) {
    res.status(400).json({ error: "缺少任务类型" });
    return;
  }

  try {
    const { runTaskByType } = await import("./_lib/task-service");
    const result = await runTaskByType(type, payload);
    res.status(200).json({
      taskId: `vercel-${Date.now()}`,
      status: "completed",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "任务执行失败",
      type,
    });
  }
}
