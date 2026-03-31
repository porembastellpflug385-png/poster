export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

const RAW_BASE_URL = process.env.POSTER_API_BASE_URL || process.env.OPENAI_BASE_URL || "https://ai.scd666.com";
const API_KEY = process.env.POSTER_API_KEY || process.env.OPENAI_API_KEY || "";
const TEXT_MODEL = process.env.POSTER_TEXT_MODEL || "deepseek-v3.2-exp";
const DEFAULT_IDEA_COUNT = Number(process.env.POSTER_IDEA_COUNT || 6);
const DEFAULT_IMAGE_COUNT = Number(process.env.POSTER_IMAGE_COUNT || 3);
const DEFAULT_IMAGE_LONG_EDGE = 2048;

const MODEL_ENDPOINT_MAP: Record<string, { type: "openai_chat" | "mj" | "flux"; endpoint: string }> = {
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

// Default poster output resolution is 2K.
// We keep the long edge at 2048px and derive the matching short edge by ratio.
const RATIO_TO_SIZE: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1152, height: DEFAULT_IMAGE_LONG_EDGE },
  "3:4": { width: 1536, height: DEFAULT_IMAGE_LONG_EDGE },
  "1:1": { width: DEFAULT_IMAGE_LONG_EDGE, height: DEFAULT_IMAGE_LONG_EDGE },
  "4:3": { width: DEFAULT_IMAGE_LONG_EDGE, height: 1536 },
  "16:9": { width: DEFAULT_IMAGE_LONG_EDGE, height: 1152 },
};

const RATIO_TO_MJ_AR: Record<string, string> = {
  "9:16": "--ar 9:16",
  "3:4": "--ar 3:4",
  "1:1": "--ar 1:1",
  "4:3": "--ar 4:3",
  "16:9": "--ar 16:9",
};

type UploadAsset = {
  id?: string;
  mimeType?: string;
  data?: string;
  url: string;
  name: string;
};

type PosterResult = {
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
  productImage?: UploadAsset | null;
  referenceImages?: UploadAsset[];
  copyLayoutMode?: "with-copy" | "without-copy";
  copyFields?: {
    headline?: string;
    subheadline?: string;
    body?: string;
    note?: string;
  };
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
  referenceImages?: UploadAsset[];
  productImage?: UploadAsset | null;
  selectedStyle: string;
  selectedRatio: string;
  selectedModel: string;
  imageCount?: number;
  fromPosterId?: string;
  copyLayoutMode?: "with-copy" | "without-copy";
  copyFields?: {
    headline?: string;
    subheadline?: string;
    body?: string;
    note?: string;
  };
};

type GenerateProposalPayload = {
  finalPoster: PosterResult | null;
  selectedTextModel?: string;
  briefSummary?: {
    subject?: string;
    audience?: string;
    channel?: string;
    tone?: string;
    prompt?: string;
    selectedStyle?: string;
    selectedRatio?: string;
  };
};

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

function assertConfigured() {
  if (!API_KEY) {
    throw new Error("服务端未配置 API Key");
  }
}

function authHeaders() {
  assertConfigured();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
}

function buildAssetUrl(asset: UploadAsset) {
  if (asset.data && asset.mimeType) {
    return `data:${asset.mimeType};base64,${asset.data}`;
  }
  return asset.url;
}

function buildMjAssetUrl(asset: UploadAsset) {
  const url = buildAssetUrl(asset);
  return url.startsWith("data:") ? url : null;
}

function extractMetaImageFromHtml(html: string, baseUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return match[1];
      }
    }
  }

  return null;
}

async function resolveRemoteReferenceUrl(url: string) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 PosterTool/1.0",
      Accept: "text/html,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`参考链接读取失败 (${response.status})`);
  }

  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType.startsWith("image/")) {
    return response.url || url;
  }

  if (contentType === "text/html" || contentType === "application/xhtml+xml") {
    const html = await response.text();
    const imageUrl = extractMetaImageFromHtml(html, response.url || url);
    if (imageUrl) {
      return imageUrl;
    }
    throw new Error("参考链接是网页，不是图片直链。请改用图片地址，或先把参考图保存后上传。");
  }

  throw new Error(`参考链接类型不支持：${contentType || "unknown"}`);
}

async function buildReferenceAssetUrl(asset: UploadAsset) {
  if (asset.data && asset.mimeType) {
    return `data:${asset.mimeType};base64,${asset.data}`;
  }

  if (/^https?:\/\//i.test(asset.url)) {
    return resolveRemoteReferenceUrl(asset.url);
  }

  return asset.url;
}

function summarizeCopyFields(
  copyFields?: {
    headline?: string;
    subheadline?: string;
    body?: string;
    note?: string;
  },
) {
  if (!copyFields) return "";
  const parts = [
    copyFields.headline ? `headline: ${copyFields.headline}` : "",
    copyFields.subheadline ? `subheadline: ${copyFields.subheadline}` : "",
    copyFields.body ? `body: ${copyFields.body}` : "",
    copyFields.note ? `note: ${copyFields.note}` : "",
  ].filter(Boolean);
  return parts.length ? `Copy content for editable overlays: ${parts.join(" | ")}.` : "";
}

function buildResolutionInstruction(ratio: string) {
  const size = RATIO_TO_SIZE[ratio] || RATIO_TO_SIZE["1:1"];
  return `Target final poster resolution: ${size.width}x${size.height} (2K default output).`;
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data.description || data.error?.message || data.message || fallback;
  } catch {
    return fallback;
  }
}

async function callOpenAIChat(messages: any[], model: string, extra: Record<string, unknown> = {}) {
  const endpoint = (MODEL_ENDPOINT_MAP[model]?.endpoint || "/v1/chat/completions").replace(/^\/v1/, "");
  const res = await fetch(`${OPENAI_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, messages, ...extra }),
  });
  if (!res.ok) {
    let message = await readErrorMessage(res, `请求失败 (${res.status})`);
    if (res.status === 404) {
      message = `模型或接口不存在: ${model}`;
    }
    throw new Error(message);
  }
  return res.json();
}

async function callTextModel(messages: any[], model = TEXT_MODEL, extra: Record<string, unknown> = {}) {
  return callOpenAIChat(messages, model, extra);
}

async function callFlux(prompt: string, model: string, ratio: string) {
  const size = RATIO_TO_SIZE[ratio] || RATIO_TO_SIZE["1:1"];
  const res = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: `${size.width}x${size.height}`,
    }),
  });
  if (!res.ok) {
    let message = await readErrorMessage(res, `Flux 失败 (${res.status})`);
    if (res.status === 404) {
      message = `Flux 接口不存在或模型不可用: ${model}`;
    }
    throw new Error(message);
  }
  const data = await res.json();
  const image = data.data?.[0];
  if (image?.url) return image.url as string;
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}` as string;
  throw new Error("Flux 未返回图片");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callMJ(model: string, prompt: string, ratio: string, base64Images?: string[]) {
  const endpoint = MODEL_ENDPOINT_MAP[model]?.endpoint;
  if (!endpoint) {
    throw new Error(`未知 MJ 端点: ${model}`);
  }

  let body: Record<string, unknown> = {};
  if (model === "mj_imagine") {
    body = { prompt: `${prompt} ${RATIO_TO_MJ_AR[ratio] || "--ar 1:1"}` };
    if (base64Images?.length) {
      body.base64Array = base64Images;
    }
  } else if (model === "mj_blend") {
    if (!base64Images || base64Images.length < 2) {
      throw new Error("MJ Blend 需要至少 2 张图片");
    }
    body = {
      base64Array: base64Images,
      dimensions: ratio === "16:9" ? "LANDSCAPE" : ratio === "9:16" ? "PORTRAIT" : "SQUARE",
    };
  } else if (model === "mj_describe") {
    if (!base64Images?.length) {
      throw new Error("MJ Describe 需要至少 1 张图片");
    }
    body = { base64: base64Images[0] };
  }

  const submitRes = await fetch(`${ROOT_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!submitRes.ok) {
    let message = await readErrorMessage(submitRes, `MJ 提交失败 (${submitRes.status})`);
    if (submitRes.status === 404) {
      message = `MJ 接口不存在或模型不可用: ${model}`;
    }
    throw new Error(message);
  }

  const submitData = await submitRes.json();
  const taskId = submitData.result || submitData.id || submitData.taskId;

  if (!taskId) {
    if (submitData.imageUrl) return submitData.imageUrl as string;
    if (submitData.url) return submitData.url as string;
    if (model === "mj_describe" && submitData.prompt) return submitData.prompt as string;
    throw new Error("MJ 未返回任务 ID");
  }

  for (let i = 0; i < 120; i += 1) {
    await sleep(2000);
    const pollRes = await fetch(`${ROOT_BASE_URL}/mj/task/${taskId}/fetch`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!pollRes.ok) {
      continue;
    }
    const pollData = await pollRes.json();
    const status = String(pollData.status || "").toUpperCase();
    if (status === "SUCCESS" || status === "COMPLETED") {
      const url = pollData.imageUrl || pollData.result?.imageUrl || pollData.url;
      if (url) {
        return url as string;
      }
      if (model === "mj_describe") {
        return (pollData.prompt || pollData.result?.prompt || "描述结果为空") as string;
      }
      throw new Error("MJ 任务完成但没有返回图片");
    }
    if (status === "FAILED" || status === "ERROR") {
      throw new Error(`MJ 失败: ${pollData.failReason || "未知错误"}`);
    }
  }

  throw new Error("MJ 任务超时");
}

function extractImageData(content: string | undefined | null) {
  if (!content) {
    throw new Error("API 返回空内容");
  }
  const markdown = content.match(/!\[.*?\]\((.*?)\)/);
  if (markdown?.[1]) {
    return markdown[1];
  }
  const http = content.match(/(https?:\/\/[^\s)"']+)/);
  if (http?.[1]) {
    return http[1];
  }
  if (content.includes("data:image")) {
    const base64 = content.match(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/);
    if (base64?.[0]) {
      return base64[0];
    }
  }
  const trimmed = content.trim();
  if (trimmed.length > 500 && !trimmed.includes(" ")) {
    return `data:image/png;base64,${trimmed}`;
  }
  throw new Error(`未返回有效图片: "${content.substring(0, 80)}..."`);
}

async function generateImage(prompt: string, model: string, ratio: string, imageUrls?: string[]) {
  const config = MODEL_ENDPOINT_MAP[model];
  if (!config) {
    throw new Error(`不支持的模型: ${model}`);
  }

  if (config.type === "openai_chat") {
    const content: any[] = [{ type: "text", text: prompt }];
    imageUrls?.forEach((url) => {
      content.push({ type: "image_url", image_url: { url } });
    });
    const res = await callOpenAIChat([{ role: "user", content }], model);
    return extractImageData(res.choices?.[0]?.message?.content);
  }

  if (config.type === "flux") {
    return callFlux(prompt, model, ratio);
  }

  return callMJ(model, prompt, ratio, imageUrls);
}

async function runCreateIdeasTask(payload: CreateIdeasPayload) {
  if (!payload.prompt.trim() && !payload.styleRefImages?.length) {
    throw new Error("请输入需求或上传参考图");
  }
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
    // populated below after resolving remote pages into real image URLs when possible
  });
  const resolvedStyleRefs = await Promise.all((payload.styleRefImages || []).map((img) => buildReferenceAssetUrl(img)));
  resolvedStyleRefs.forEach((url) => {
    content.push({ type: "image_url", image_url: { url } });
  });
  const res = await callTextModel([{ role: "user", content }], payload.selectedTextModel || TEXT_MODEL, {
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices?.[0]?.message?.content || "{}");
  const ideas = parsed.ideas || (Object.values(parsed).find(Array.isArray) as string[]) || [];
  while (ideas.length < ideaCount) {
    ideas.push("Creative poster design with unique artistic composition and bold visual impact");
  }
  return { ideas: ideas.slice(0, ideaCount) };
}

async function runGeneratePostersTask(payload: GeneratePostersPayload) {
  if (!payload.selectedIdeas.length) {
    throw new Error("请选择创意");
  }
  const stylePrompt = STYLE_PROMPTS[payload.selectedStyle] || "";
  const resolutionInstruction = buildResolutionInstruction(payload.selectedRatio);
  const imageCount = [1, 2, 3].includes(payload.imageCount || 0) ? payload.imageCount! : DEFAULT_IMAGE_COUNT;
  const posters: PosterResult[] = [];
  const resolvedProductImage = payload.productImage ? await buildReferenceAssetUrl(payload.productImage) : null;
  const referenceImages = await Promise.all((payload.referenceImages || []).map((asset) => buildReferenceAssetUrl(asset)));
  const combinedReferenceImages = [resolvedProductImage, ...referenceImages].filter(Boolean) as string[];
  const mjCombinedReferenceImages = [
    payload.productImage ? buildMjAssetUrl(payload.productImage) : null,
    ...(payload.referenceImages || []).map((asset) => buildMjAssetUrl(asset)),
  ].filter(Boolean) as string[];
  const mjReferenceImages = (payload.referenceImages || [])
    .map((asset) => buildMjAssetUrl(asset))
    .filter(Boolean) as string[];
  const activeReferenceImages = payload.selectedModel.startsWith("mj_") ? mjCombinedReferenceImages : combinedReferenceImages;
  const copyInstruction =
    payload.copyLayoutMode === "with-copy"
      ? "Reserve clean, professional copy-safe areas for editable headline, subheadline, body, note, logo and QR placements. Do not render any legible text, letters, numbers, watermarks or logos into the background image itself."
      : "Do not include any letters, words, numbers, logos, watermarks, signage or readable typography anywhere in the image.";
  const productInstruction = resolvedProductImage
    ? "Treat the uploaded product image as the main subject. Preserve its core shape, material cues and brand silhouette."
    : "";
  const copyFieldsInstruction = summarizeCopyFields(payload.copyFields);

  for (const idx of payload.selectedIdeas) {
    const idea = payload.ideas[idx];
    const variants = await Promise.all(
      Array.from({ length: imageCount }, (_, index) =>
        generateImage(
          `${idea}. ${stylePrompt} Aspect ratio: ${payload.selectedRatio}. ${resolutionInstruction} ${productInstruction} ${copyInstruction} ${copyFieldsInstruction} High quality poster. Variation ${index + 1}.`,
          payload.selectedModel,
          payload.selectedRatio,
          activeReferenceImages,
        ),
      ),
    );

    variants.forEach((url) => {
      posters.push({
        id: createId(),
        url,
        ideaText: idea.substring(0, 60),
        timestamp: Date.now(),
      });
    });
  }

  return { posters };
}

async function runOptimizeExistingTask(payload: OptimizeExistingPayload) {
  if (!payload.uploadedPosters?.length) {
    throw new Error("请上传海报");
  }
  const stylePrompt = STYLE_PROMPTS[payload.selectedStyle] || "";
  const resolutionInstruction = buildResolutionInstruction(payload.selectedRatio);
  const imageUrls = payload.uploadedPosters.map((img) => `data:${img.mimeType};base64,${img.data}`);
  const imageCount = [1, 2, 3].includes(payload.imageCount || 0) ? payload.imageCount! : DEFAULT_IMAGE_COUNT;
  const results = await Promise.all(
    Array.from({ length: imageCount }, (_, index) =>
      generateImage(
        `Redesign and optimize this poster. ${stylePrompt} Aspect ratio: ${payload.selectedRatio}. ${resolutionInstruction} ${
          payload.optimizeFeedback || "Make it more professional and visually striking."
        } Variation ${index + 1}.`,
        payload.selectedModel,
        payload.selectedRatio,
        imageUrls,
      ),
    ),
  );

  return {
    posters: results.map((url, index) => ({
      id: createId(),
      url,
      ideaText: `原图优化 v${index + 1}`,
      timestamp: Date.now(),
    })),
  };
}

async function runOptimizePosterTask(payload: OptimizePosterPayload) {
  if (!payload.activePoster) {
    throw new Error("请选择海报");
  }
  if (!payload.feedbackText.trim()) {
    throw new Error("请输入反馈");
  }
  const stylePrompt = STYLE_PROMPTS[payload.selectedStyle] || "";
  const resolutionInstruction = buildResolutionInstruction(payload.selectedRatio);
  const imageCount = [1, 2, 3].includes(payload.imageCount || 0) ? payload.imageCount! : DEFAULT_IMAGE_COUNT;
  const referenced: UploadAsset[] = [];
  const regex = /@图\s*(\d+)/g;
  let matched: RegExpExecArray | null;
  while ((matched = regex.exec(payload.feedbackText)) !== null) {
    const index = Number.parseInt(matched[1], 10) - 1;
    if (payload.refImages[index]) {
      referenced.push(payload.refImages[index]);
    }
  }
  const resolvedExplicitRefs = await Promise.all(
    (payload.referenceImages || []).map((asset) => buildReferenceAssetUrl(asset)),
  );
  const resolvedMentionedRefs = await Promise.all(referenced.map((asset) => buildReferenceAssetUrl(asset)));
  const resolvedProductImage = payload.productImage ? await buildReferenceAssetUrl(payload.productImage) : null;
  const referenceSet = Array.from(
    new Set(
      [
        payload.activePoster.url,
        resolvedProductImage,
        ...resolvedExplicitRefs,
        ...resolvedMentionedRefs,
      ].filter(Boolean) as string[],
    ),
  );
  const copyInstruction =
    payload.copyLayoutMode === "with-copy"
      ? "Keep clean editable copy-safe areas in the composition. Do not burn real text, logos, QR codes or readable typography into the background image."
      : "Do not include any readable text, numbers, logos, watermarks or signage in the regenerated image.";
  const productInstruction = resolvedProductImage
    ? "Use the uploaded product image as a key subject reference while applying the requested modifications."
    : "";
  const copyFieldsInstruction = summarizeCopyFields(payload.copyFields);
  const basePrompt = `Optimize this poster based on the feedback: "${payload.feedbackText}". ${stylePrompt} Ratio: ${payload.selectedRatio}. ${resolutionInstruction} ${productInstruction} ${copyInstruction} ${copyFieldsInstruction} Apply the changes clearly while preserving the strongest parts of the current layout.`;
  const results = await Promise.all(
    Array.from({ length: imageCount }, (_, index) =>
      generateImage(`${basePrompt} Variation ${index + 1}.`, payload.selectedModel, payload.selectedRatio, referenceSet),
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
  if (!payload.finalPoster) {
    throw new Error("请选择定稿");
  }
  const styleLabel = payload.briefSummary?.selectedStyle || "未设置";
  const ratioLabel = payload.briefSummary?.selectedRatio || "未设置";
  const contextLines = [
    `项目主题：${payload.briefSummary?.subject || "未填写"}`,
    `目标受众：${payload.briefSummary?.audience || "未填写"}`,
    `投放场景：${payload.briefSummary?.channel || "未填写"}`,
    `视觉气质：${payload.briefSummary?.tone || "未填写"}`,
    `补充说明：${payload.briefSummary?.prompt || "无"}`,
    `海报风格：${styleLabel}`,
    `海报画幅：${ratioLabel}`,
    `当前定稿描述：${payload.finalPoster.ideaText || "未提供"}`,
  ].join("\n");
  const content: any[] = [
    {
      type: "text",
      text: `你是资深品牌策划师。请基于下面的项目信息，为这张定稿海报撰写一份专业、可直接用于汇报或交付的中文提案。

${contextLines}

输出结构：
1. 设计理念
2. 视觉分析（构图、色彩、字体/层级）
3. 受众洞察与传播策略
4. 应用场景与投放建议
5. 下一步可优化方向

要求：
- 直接输出正文，不要 JSON
- 语言专业、简洁、有提案感
- 如果没有看到海报图像，也要基于项目上下文和定稿描述给出可信分析`,
    },
  ];
  if (/^https?:\/\//i.test(payload.finalPoster.url)) {
    content.push({ type: "image_url", image_url: { url: payload.finalPoster.url } });
  }
  const res = await callTextModel([
    {
      role: "user",
      content,
    },
  ], payload.selectedTextModel || TEXT_MODEL, {
    temperature: 0.7,
    max_tokens: 1200,
  });
  return { proposalText: res.choices?.[0]?.message?.content || "生成失败" };
}

async function runTaskByType(type: string, payload: any) {
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
    const approxBytes = Buffer.byteLength(JSON.stringify(body || {}), "utf8");
    if (approxBytes > 6 * 1024 * 1024) {
      res.status(413).json({ error: "上传内容过大，请减少参考图数量，或使用更小的图片后重试。", type });
      return;
    }
  } catch {
    // ignore size estimation failures
  }

  try {
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
