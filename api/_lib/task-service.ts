const RAW_BASE_URL = process.env.POSTER_API_BASE_URL || process.env.OPENAI_BASE_URL || "https://ai.scd666.com";
const API_KEY = process.env.POSTER_API_KEY || process.env.OPENAI_API_KEY || "";
const TEXT_MODEL = process.env.POSTER_TEXT_MODEL || "deepseek-v3.2-exp";
const DEFAULT_IDEA_COUNT = Number(process.env.POSTER_IDEA_COUNT || 6);
const DEFAULT_IMAGE_COUNT = Number(process.env.POSTER_IMAGE_COUNT || 3);

function createId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function stripTrailingV1(url: string) {
  return stripTrailingSlash(url).replace(/\/v1$/i, "");
}

const ROOT_BASE_URL = stripTrailingV1(RAW_BASE_URL);
const OPENAI_BASE_URL = stripTrailingSlash(RAW_BASE_URL).endsWith("/v1")
  ? stripTrailingSlash(RAW_BASE_URL)
  : `${ROOT_BASE_URL}/v1`;

const MODEL_ENDPOINT_MAP: Record<string, { type: string; endpoint: string }> = {
  "gemini-3.1-flash-image-preview": { type: "openai_chat", endpoint: "/v1/chat/completions" },
  "gemini-3-pro-image-preview": { type: "openai_chat", endpoint: "/v1/chat/completions" },
  mj_imagine: { type: "mj", endpoint: "/mj/submit/imagine" },
  mj_blend: { type: "mj", endpoint: "/mj/submit/blend" },
  mj_describe: { type: "mj", endpoint: "/mj/submit/describe" },
  "flux-pro": { type: "flux", endpoint: "/v1/images/generations" },
  "flux-1.1-pro": { type: "flux", endpoint: "/v1/images/generations" },
};

const STYLE_PROMPTS: Record<string, string> = {
  photography:
    "Cinematic photography poster, professional studio lighting, high-resolution, photorealistic, dramatic composition, commercial quality",
  handdrawn:
    "Hand-drawn illustration poster, watercolor and ink textures, artistic brushstrokes, warm organic feel, hand-crafted aesthetic",
  "3d":
    "3D rendered poster, Cinema 4D style, volumetric lighting, glossy materials, depth of field, modern 3D design",
  abstract:
    "Abstract art poster, bold geometric forms, avant-garde composition, vibrant color blocks, contemporary art style",
  flat:
    "Flat design poster, clean vector graphics, minimal shadows, bold solid colors, modern flat illustration style",
  miniature:
    "Miniature tilt-shift diorama poster, tiny detailed world, selective focus, toy-like proportions, warm lighting",
  product:
    "Product showcase poster, commercial photography, clean background, professional product placement, premium commercial quality",
  anime: "Anime style poster, Japanese animation aesthetic, vivid colors, dynamic composition, manga-inspired illustration",
  smart: "",
};

const RATIO_TO_SIZE: Record<string, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "3:4": { width: 768, height: 1024 },
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "16:9": { width: 1280, height: 720 },
};

const RATIO_TO_MJ_AR: Record<string, string> = {
  "9:16": "--ar 9:16",
  "3:4": "--ar 3:4",
  "1:1": "--ar 1:1",
  "4:3": "--ar 4:3",
  "16:9": "--ar 16:9",
};

export type UploadAsset = {
  id?: string;
  mimeType: string;
  data: string;
  url: string;
  name: string;
};

export type PosterResult = {
  id: string;
  url: string;
  ideaText: string;
  timestamp: number;
};

type CreateIdeasPayload = {
  prompt: string;
  selectedStyle: string;
  selectedRatio: string;
  styleRefImages: UploadAsset[];
  selectedTextModel?: string;
  ideaCount?: number;
};

type GeneratePostersPayload = {
  selectedIdeas: number[];
  ideas: string[];
  selectedStyle: string;
  selectedRatio: string;
  selectedModel: string;
  imageCount?: number;
};

type OptimizeExistingPayload = {
  uploadedPosters: UploadAsset[];
  optimizeFeedback: string;
  selectedStyle: string;
  selectedRatio: string;
  selectedModel: string;
  imageCount?: number;
};

type OptimizePosterPayload = {
  activePoster: PosterResult | null;
  feedbackText: string;
  refImages: UploadAsset[];
  selectedStyle: string;
  selectedRatio: string;
  selectedModel: string;
  imageCount?: number;
};

type GenerateProposalPayload = {
  finalPoster: PosterResult | null;
};

export function getServiceConfig() {
  return {
    ok: true,
    configured: Boolean(API_KEY),
    envKeys: {
      hasPosterApiKey: Boolean(process.env.POSTER_API_KEY),
      hasPosterBaseUrl: Boolean(process.env.POSTER_API_BASE_URL),
      hasOpenAiApiKey: Boolean(process.env.OPENAI_API_KEY),
      hasOpenAiBaseUrl: Boolean(process.env.OPENAI_BASE_URL),
    },
    baseUrl: RAW_BASE_URL,
    normalizedBaseUrl: ROOT_BASE_URL,
    openaiBaseUrl: OPENAI_BASE_URL,
    textModel: TEXT_MODEL,
    tips: [
      "如果 configured 为 false，优先检查 Vercel 环境变量是否已重新部署生效。",
      "如果 OPENAI_BASE_URL 已包含 /v1，系统会自动避免重复拼接。",
      "MJ 请求会自动使用去掉 /v1 后的根地址。",
    ],
  };
}

function assertConfigured() {
  if (!API_KEY) throw new Error("服务端未配置 POSTER_API_KEY");
}

function authHeaders() {
  assertConfigured();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
}

async function callOpenAIChat(messages: any[], model: string, extra: any = {}) {
  const ep = MODEL_ENDPOINT_MAP[model]?.endpoint || "/v1/chat/completions";
  const normalizedEndpoint = ep.replace(/^\/v1/, "");
  const res = await fetch(`${OPENAI_BASE_URL}${normalizedEndpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, messages, ...extra }),
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data.error?.message) message = data.error.message;
    } catch {}
    if (res.status === 404) message = `模型或接口不存在: ${model} -> ${ep}`;
    throw new Error(message);
  }
  return res.json();
}

async function callTextModel(messages: any[], model = TEXT_MODEL, extra: any = {}) {
  return callOpenAIChat(messages, model, extra);
}

async function callFlux(prompt: string, model: string, ratio: string): Promise<string> {
  const size = RATIO_TO_SIZE[ratio] || RATIO_TO_SIZE["1:1"];
  const res = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, prompt, n: 1, size: `${size.width}x${size.height}` }),
  });
  if (!res.ok) {
    let message = `Flux 失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data.error?.message) message = data.error.message;
    } catch {}
    if (res.status === 404) message = `Flux 接口不存在或模型不可用: ${model}`;
    throw new Error(message);
  }
  const data = await res.json();
  const image = data.data?.[0];
  if (image?.url) return image.url;
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  throw new Error("Flux 未返回图片");
}

async function callMJ(model: string, prompt: string, ratio: string, base64Images?: string[]): Promise<string> {
  const ep = MODEL_ENDPOINT_MAP[model]?.endpoint;
  if (!ep) throw new Error(`未知 MJ 端点: ${model}`);

  let body: any = {};
  if (model === "mj_imagine") {
    body = { prompt: `${prompt} ${RATIO_TO_MJ_AR[ratio] || "--ar 1:1"}` };
    if (base64Images?.length) body.base64Array = base64Images;
  } else if (model === "mj_blend") {
    if (!base64Images || base64Images.length < 2) throw new Error("MJ Blend 需要至少 2 张图片");
    body = {
      base64Array: base64Images,
      dimensions: ratio === "16:9" ? "LANDSCAPE" : ratio === "9:16" ? "PORTRAIT" : "SQUARE",
    };
  } else if (model === "mj_describe") {
    if (!base64Images?.length) throw new Error("MJ Describe 需要一张图片");
    body = { base64: base64Images[0] };
  }

  const submitRes = await fetch(`${ROOT_BASE_URL}${ep}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!submitRes.ok) {
    let message = `MJ 提交失败 (${submitRes.status})`;
    try {
      const data = await submitRes.json();
      message = data.description || data.error?.message || message;
    } catch {}
    if (submitRes.status === 404) message = `MJ 接口不存在或模型不可用: ${model}`;
    throw new Error(message);
  }
  const submitData = await submitRes.json();
  const taskId = submitData.result || submitData.id || submitData.taskId;

  if (!taskId) {
    if (submitData.imageUrl) return submitData.imageUrl;
    if (submitData.url) return submitData.url;
    if (model === "mj_describe" && submitData.prompt) return submitData.prompt;
    throw new Error(`MJ 未返回任务ID: ${JSON.stringify(submitData).substring(0, 200)}`);
  }

  for (let i = 0; i < 120; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollingRes = await fetch(`${ROOT_BASE_URL}/mj/task/${taskId}/fetch`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!pollingRes.ok) continue;
    const pollingData = await pollingRes.json();
    const status = (pollingData.status || "").toUpperCase();
    if (status === "SUCCESS" || status === "COMPLETED") {
      const url = pollingData.imageUrl || pollingData.result?.imageUrl || pollingData.url;
      if (url) return url;
      if (model === "mj_describe") return pollingData.prompt || pollingData.result?.prompt || "描述结果为空";
      throw new Error("MJ 任务完成但无图片");
    }
    if (status === "FAILED" || status === "ERROR") throw new Error(`MJ 失败: ${pollingData.failReason || "未知"}`);
  }

  throw new Error("MJ 任务超时");
}

function extractImageData(content: string | undefined | null): string {
  if (!content) throw new Error("API 返回空内容");
  const markdown = content.match(/!\[.*?\]\((.*?)\)/);
  if (markdown?.[1]) return markdown[1];
  const http = content.match(/(https?:\/\/[^\s)"']+)/);
  if (http?.[1]) return http[1];
  if (content.includes("data:image")) {
    const base64 = content.match(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/);
    if (base64) return base64[0];
  }
  const trimmed = content.trim();
  if (trimmed.length > 500 && !trimmed.includes(" ")) return `data:image/png;base64,${trimmed}`;
  throw new Error(`未返回有效图片: "${content.substring(0, 80)}..."`);
}

async function generateImage(prompt: string, model: string, ratio: string, imageUrls?: string[]): Promise<string> {
  const config = MODEL_ENDPOINT_MAP[model];
  if (!config) throw new Error(`不支持的模型: ${model}`);
  if (config.type === "openai_chat") {
    const content: any[] = [{ type: "text", text: prompt }];
    imageUrls?.forEach((url) => content.push({ type: "image_url", image_url: { url } }));
    const res = await callOpenAIChat([{ role: "user", content }], model);
    return extractImageData(res.choices?.[0]?.message?.content);
  }
  if (config.type === "flux") return callFlux(prompt, model, ratio);
  if (config.type === "mj") return callMJ(model, prompt, ratio, imageUrls);
  throw new Error(`未知类型: ${config.type}`);
}

async function runCreateIdeasTask(payload: CreateIdeasPayload) {
  if (!payload.prompt.trim() && !payload.styleRefImages?.length) throw new Error("请输入需求或上传参考图");
  const ideaCount = [2, 4, 6].includes(payload.ideaCount || 0) ? payload.ideaCount! : DEFAULT_IDEA_COUNT;
  const content: any[] = [
    {
      type: "text",
      text: `你是一位顶尖海报设计创意总监。生成${ideaCount}个完全不同的创意提示词（英文prompt），详细描述海报视觉内容、构图、氛围。
需求: "${payload.prompt}"
美术风格: ${payload.selectedStyle}
画幅: ${payload.selectedRatio}
${payload.selectedStyle === "smart" && payload.styleRefImages?.length ? "根据参考图风格决定方向。" : ""}
如果用户在需求中使用@图N，请把对应参考图一起纳入理解。
严格返回JSON: {"ideas": ["p1","p2"]}`,
    },
  ];
  payload.styleRefImages?.forEach((img) => {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  });
  const res = await callTextModel([{ role: "user", content }], payload.selectedTextModel || TEXT_MODEL, {
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices?.[0]?.message?.content || "{}");
  const ideas = parsed.ideas || (Object.values(parsed).find(Array.isArray) as string[]) || [];
  while (ideas.length < ideaCount) ideas.push("Creative poster design with unique artistic composition and bold visual impact");
  return { ideas: ideas.slice(0, ideaCount) };
}

async function runGeneratePostersTask(payload: GeneratePostersPayload) {
  if (!payload.selectedIdeas.length) throw new Error("请选择创意");
  const stylePrompt = STYLE_PROMPTS[payload.selectedStyle] || "";
  const imageCount = [1, 2, 3].includes(payload.imageCount || 0) ? payload.imageCount! : DEFAULT_IMAGE_COUNT;
  const posters: PosterResult[] = [];
  for (const idx of payload.selectedIdeas) {
    const idea = payload.ideas[idx];
    const variants = await Promise.all(
      Array.from({ length: imageCount }, (_, i) => i + 1).map((version) =>
        generateImage(
          `${idea}. ${stylePrompt} Aspect ratio: ${payload.selectedRatio}. High quality poster. Variation ${version}.`,
          payload.selectedModel,
          payload.selectedRatio,
        ),
      ),
    );
    variants.forEach((url) => posters.push({ id: createId(), url, ideaText: idea.substring(0, 60), timestamp: Date.now() }));
  }
  return { posters };
}

async function runOptimizeExistingTask(payload: OptimizeExistingPayload) {
  if (!payload.uploadedPosters?.length) throw new Error("请上传海报");
  const stylePrompt = STYLE_PROMPTS[payload.selectedStyle] || "";
  const imageUrls = payload.uploadedPosters.map((img) => `data:${img.mimeType};base64,${img.data}`);
  const imageCount = [1, 2, 3].includes(payload.imageCount || 0) ? payload.imageCount! : DEFAULT_IMAGE_COUNT;
  const results = await Promise.all(
    Array.from({ length: imageCount }, (_, i) => i + 1).map((version) =>
      generateImage(
        `Redesign and optimize this poster. ${stylePrompt} Aspect ratio: ${payload.selectedRatio}. ${
          payload.optimizeFeedback || "Make it more professional and visually striking."
        } Variation ${version}.`,
        payload.selectedModel,
        payload.selectedRatio,
        imageUrls,
      ),
    ),
  );
  return {
    posters: results.map((url, index) => ({ id: createId(), url, ideaText: `原图优化 v${index + 1}`, timestamp: Date.now() })),
  };
}

async function runOptimizePosterTask(payload: OptimizePosterPayload) {
  if (!payload.activePoster) throw new Error("请选择海报");
  if (!payload.feedbackText.trim()) throw new Error("请输入反馈");
  const stylePrompt = STYLE_PROMPTS[payload.selectedStyle] || "";
  const imageCount = [1, 2, 3].includes(payload.imageCount || 0) ? payload.imageCount! : DEFAULT_IMAGE_COUNT;
  const referenced: UploadAsset[] = [];
  const regex = /@图\s*(\d+)/g;
  let matched;
  while ((matched = regex.exec(payload.feedbackText)) !== null) {
    const index = parseInt(matched[1], 10) - 1;
    if (payload.refImages[index]) referenced.push(payload.refImages[index]);
  }
  const imageUrls = [payload.activePoster.url, ...referenced.map((img) => `data:${img.mimeType};base64,${img.data}`)];
  const basePrompt = `Optimize this poster: "${payload.feedbackText}". ${stylePrompt} Ratio: ${payload.selectedRatio}. Apply changes.`;
  const results = await Promise.all(
    Array.from({ length: imageCount }, (_, i) => i + 1).map((version) =>
      generateImage(`${basePrompt} Variation ${version}.`, payload.selectedModel, payload.selectedRatio, imageUrls),
    ),
  );
  return {
    posters: results.map((url) => ({
      id: createId(),
      url,
      ideaText: `优化: ${payload.feedbackText.substring(0, 40)}`,
      timestamp: Date.now(),
    })),
  };
}

async function runGenerateProposalTask(payload: GenerateProposalPayload) {
  if (!payload.finalPoster) throw new Error("请选择定稿");
  const res = await callTextModel([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `你是资深品牌策划师。为这张海报撰写专业提案：
1. 设计理念
2. 视觉分析（构图、色彩、字体）
3. 受众与传播策略
4. 应用场景
5. 优化方向
中文撰写，有深度。`,
        },
        { type: "image_url", image_url: { url: payload.finalPoster.url } },
      ],
    },
  ]);
  return { proposalText: res.choices?.[0]?.message?.content || "生成失败" };
}

export async function runTaskByType(type: string, payload: any) {
  switch (type) {
    case "ideas":
      return runCreateIdeasTask(payload as CreateIdeasPayload);
    case "generate-posters":
      return runGeneratePostersTask(payload as GeneratePostersPayload);
    case "optimize-existing":
      return runOptimizeExistingTask(payload as OptimizeExistingPayload);
    case "optimize-poster":
      return runOptimizePosterTask(payload as OptimizePosterPayload);
    case "proposal":
      return runGenerateProposalTask(payload as GenerateProposalPayload);
    default:
      throw new Error(`未知任务类型: ${type}`);
  }
}
