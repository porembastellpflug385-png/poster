import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Monitor,
  MoonStar,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { StepRail } from "./components/StepRail";
import { runTask } from "./lib/api";
import { useTheme } from "./theme";

const IMAGE_MODELS = [
  { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash", tag: "快速" },
  { id: "gemini-3-pro-image-preview", label: "Gemini 3 Pro", tag: "高质量" },
  { id: "mj_imagine", label: "MJ Imagine", tag: "创意" },
  { id: "mj_blend", label: "MJ Blend", tag: "融合" },
  { id: "mj_describe", label: "MJ Describe", tag: "描述" },
  { id: "flux-pro", label: "Flux Pro", tag: "稳定" },
  { id: "flux-1.1-pro", label: "Flux 1.1 Pro", tag: "精细" },
];
const TEXT_MODELS = [
  { id: "deepseek-v3.2-exp", label: "DeepSeek V3.2", tag: "稳定" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", tag: "快速" },
  { id: "gpt-4.1", label: "GPT-4.1", tag: "高质量" },
];

const ART_STYLES = [
  { id: "photography", label: "摄影海报", icon: Camera, desc: "真实摄影质感" },
  { id: "handdrawn", label: "手绘海报", icon: Edit3, desc: "手绘温暖质感" },
  { id: "3d", label: "三维海报", icon: Sparkles, desc: "3D渲染空间感" },
  { id: "abstract", label: "抽象风格", icon: Wand2, desc: "前卫艺术视觉" },
  { id: "flat", label: "扁平风格", icon: Monitor, desc: "简洁明快设计" },
  { id: "miniature", label: "微缩景观", icon: ImageIcon, desc: "微缩精致趣味" },
  { id: "product", label: "产品海报", icon: FolderOpen, desc: "商业产品展示" },
  { id: "anime", label: "动漫海报", icon: Star, desc: "二次元美学" },
  { id: "smart", label: "智能模式", icon: Sparkles, desc: "自动匹配风格" },
];

const ASPECT_RATIOS = [
  { id: "9:16", w: 9, h: 16, desc: "竖版" },
  { id: "3:4", w: 3, h: 4, desc: "竖版" },
  { id: "1:1", w: 1, h: 1, desc: "方形" },
  { id: "4:3", w: 4, h: 3, desc: "横版" },
  { id: "16:9", w: 16, h: 9, desc: "横版" },
];

const STEPS = ["需求输入", "创意选择", "海报生成", "反馈优化", "定稿提案"];
const QUICK_BRIEF_CHIPS = [
  "新品发布海报，突出高级感和品牌质感",
  "电商促销海报，强调价格与主视觉冲击",
  "社媒传播海报，更年轻、更吸睛",
  "活动招募海报，信息清晰、重点突出",
];
const QUICK_FEEDBACK_CHIPS = [
  "整体更高级一点",
  "主体更突出，背景弱化",
  "颜色更统一，减少杂乱感",
  "构图更简洁，留白更多",
  "更适合社交媒体传播",
];
const IDEA_COUNT_OPTIONS = [2, 4, 6] as const;
const IMAGE_COUNT_OPTIONS = [1, 2, 3] as const;
const STORAGE_KEY = "poster_storage";
const MAX_PERSISTED_STORAGE_ITEMS = 24;
const REFERENCE_SEARCH_PROVIDERS = [
  {
    id: "pinterest",
    label: "Pinterest",
    description: "适合找风格、构图和氛围参考",
    buildUrl: (query: string) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
  },
  {
    id: "huaban",
    label: "花瓣",
    description: "适合中文场景下找海报和平面参考",
    buildUrl: (query: string) => `https://huaban.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "behance",
    label: "Behance",
    description: "适合看更完整的品牌与设计项目",
    buildUrl: (query: string) => `https://www.behance.net/search/projects?search=${encodeURIComponent(query)}`,
  },
  {
    id: "dribbble",
    label: "Dribbble",
    description: "适合看较强视觉表达和商业风格",
    buildUrl: (query: string) => `https://dribbble.com/search/${encodeURIComponent(query)}`,
  },
  {
    id: "google-images",
    label: "Google 图片",
    description: "适合先快速扫一轮全网视觉方向",
    buildUrl: (query: string) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
  },
] as const;
const REFERENCE_IMPORT_TIPS = [
  "优先使用图片直链，通常以 .jpg、.jpeg、.png、.webp 结尾。",
  "如果复制的是 Pinterest / 花瓣详情页，系统会先尝试自动提取主图。",
  "如果自动提取失败，最稳的方式是打开大图后复制图片地址，或直接保存截图上传。",
];

type UploadAsset = {
  id?: string;
  mimeType?: string;
  data?: string;
  url: string;
  name: string;
};

type PosterItem = {
  id: string;
  url: string;
  ideaText: string;
  timestamp: number;
  batchId?: string;
  sourceLabel?: string;
  sourceType?: "ideas" | "optimize-existing" | "optimize-poster";
};

type StorageItem = {
  id: string;
  url: string;
  label: string;
  timestamp: number;
};

function isPersistableStorageUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function buildPersistedStorage(items: StorageItem[]) {
  return items
    .filter((item) => isPersistableStorageUrl(item.url))
    .slice(0, MAX_PERSISTED_STORAGE_ITEMS);
}

function buildAssetModelUrl(asset: UploadAsset) {
  if (asset.data && asset.mimeType) {
    return `data:${asset.mimeType};base64,${asset.data}`;
  }
  return asset.url;
}

type IdeasTaskResult = {
  ideas: string[];
};

type PostersTaskResult = {
  posters: PosterItem[];
};

type ProposalTaskResult = {
  proposalText: string;
};

type BriefFieldKey = "subject" | "audience" | "channel" | "tone";
type SummaryDataItem = {
  label: string;
  value: string;
  emphasize?: boolean;
};
type NoticeState = {
  tone: "success" | "error";
  message: string;
} | null;

const BRIEF_FIELD_META: { key: BriefFieldKey; label: string; placeholder: string }[] = [
  { key: "subject", label: "主题", placeholder: "例如：新品耳机上市" },
  { key: "audience", label: "受众", placeholder: "例如：年轻白领" },
  { key: "channel", label: "场景", placeholder: "例如：小红书封面" },
  { key: "tone", label: "气质", placeholder: "例如：简洁高级" },
];
const BRIEF_TEMPLATES: Array<{
  id: string;
  label: string;
  description: string;
  fields: Record<BriefFieldKey, string>;
  prompt: string;
  style?: string;
  ratio?: string;
}> = [
  {
    id: "product-launch",
    label: "新品发布",
    description: "强调产品质感与品牌高级感",
    fields: {
      subject: "新品发布海报",
      audience: "关注设计和品质的年轻消费人群",
      channel: "品牌官网与社交媒体首发",
      tone: "高级、克制、现代",
    },
    prompt: "突出产品主视觉、品牌识别和上市氛围，画面简洁但有记忆点。",
    style: "product",
    ratio: "4:3",
  },
  {
    id: "promo",
    label: "电商促销",
    description: "强调价格卖点和视觉冲击",
    fields: {
      subject: "电商促销海报",
      audience: "对价格敏感且决策快的线上消费者",
      channel: "电商首页与活动会场",
      tone: "直接、醒目、有冲击力",
    },
    prompt: "突出优惠信息、主打卖点和购买欲，让用户一眼抓到重点。",
    style: "flat",
    ratio: "1:1",
  },
  {
    id: "social",
    label: "社媒封面",
    description: "适合小红书、朋友圈等传播场景",
    fields: {
      subject: "社媒传播海报",
      audience: "年轻用户与内容平台浏览者",
      channel: "小红书、朋友圈、短视频封面",
      tone: "轻快、精致、易传播",
    },
    prompt: "强化首屏吸引力和传播感，适合移动端快速浏览。",
    style: "photography",
    ratio: "9:16",
  },
  {
    id: "event",
    label: "活动招募",
    description: "更强调信息层级和可读性",
    fields: {
      subject: "活动招募海报",
      audience: "潜在报名用户和活动参与者",
      channel: "社群海报与报名页传播",
      tone: "专业、清晰、可信",
    },
    prompt: "让标题、时间、地点和利益点层次清楚，信息传达高效。",
    style: "product",
    ratio: "3:4",
  },
];
const RESULT_FILTERS = [
  { id: "all", label: "全部结果" },
  { id: "latest", label: "本轮生成" },
  { id: "compare", label: "已加入对比" },
  { id: "final", label: "定稿候选" },
] as const;
const FEEDBACK_FOCUS_OPTIONS = ["颜色", "构图", "主体", "背景", "文案层级"];
const EXPORT_PRESETS = [
  {
    id: "social-portrait",
    label: "社媒竖版",
    width: 1080,
    height: 1920,
    suffix: "social-portrait",
    usage: "适合小红书封面、短视频首屏、移动端视觉传播",
  },
  {
    id: "social-square",
    label: "社媒方图",
    width: 1080,
    height: 1080,
    suffix: "social-square",
    usage: "适合朋友圈配图、微博配图、电商活动卡片",
  },
  {
    id: "presentation",
    label: "横版展示",
    width: 1920,
    height: 1080,
    suffix: "presentation",
    usage: "适合提案汇报、官网横幅、会议展示页面",
  },
] as const;

function SectionHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function WorkbenchCard({
  title,
  subtitle,
  children,
  accent = "blue",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: "blue" | "green";
}) {
  const accentClass =
    accent === "green"
      ? "from-emerald-500/16 via-emerald-500/4 to-transparent"
      : "from-blue-500/16 via-blue-500/4 to-transparent";

  return (
    <section className={`surface-card relative overflow-hidden rounded-[30px] p-6 md:p-7`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${accentClass}`} />
      <div className="relative">
        <SectionHeader title={title} description={subtitle} />
        {children}
      </div>
    </section>
  );
}

function ModelPill({ modelId }: { modelId: string }) {
  const model = IMAGE_MODELS.find((item) => item.id === modelId);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
      <Sparkles size={12} />
      {model?.label}
    </span>
  );
}

function SummaryItem({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-[22px] bg-[var(--surface-muted)] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
      <p className={`mt-2 truncate text-sm ${emphasize ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
        {value}
      </p>
    </div>
  );
}

export default function App() {
  const { resolvedTheme } = useTheme();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");

  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id);
  const [selectedTextModel, setSelectedTextModel] = useState(TEXT_MODELS[0].id);
  const [selectedStyle, setSelectedStyle] = useState("photography");
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showTextModelPicker, setShowTextModelPicker] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<"idle" | "queued" | "running" | "completed" | "failed">("idle");
  const [ideaCount, setIdeaCount] = useState<(typeof IDEA_COUNT_OPTIONS)[number]>(6);
  const [imageCount, setImageCount] = useState<(typeof IMAGE_COUNT_OPTIONS)[number]>(3);

  const [briefFields, setBriefFields] = useState<Record<BriefFieldKey, string>>({
    subject: "",
    audience: "",
    channel: "",
    tone: "",
  });
  const [prompt, setPrompt] = useState("");
  const [styleRefImages, setStyleRefImages] = useState<UploadAsset[]>([]);
  const styleRefInputRef = useRef<HTMLInputElement>(null);
  const [referenceSearchInput, setReferenceSearchInput] = useState("");
  const [referenceSearchQuery, setReferenceSearchQuery] = useState("");
  const [referenceImportUrl, setReferenceImportUrl] = useState("");

  const referenceImportHint = referenceImportUrl.trim()
    ? /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(referenceImportUrl.trim())
      ? "看起来像图片直链，可以直接作为风格参考。"
      : /pinterest\.|huaban\.|behance\.|dribbble\.|google\./i.test(referenceImportUrl.trim())
        ? "看起来像网页链接，系统会尝试自动提取主图。"
        : "如果这不是图片直链，建议改用图片地址或直接上传截图。"
    : "";

  const [uploadedPosters, setUploadedPosters] = useState<UploadAsset[]>([]);
  const [optimizeFeedback, setOptimizeFeedback] = useState("");
  const uploadPosterRef = useRef<HTMLInputElement>(null);

  const [ideas, setIdeas] = useState<string[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<number[]>([]);

  const [posters, setPosters] = useState<PosterItem[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFocuses, setFeedbackFocuses] = useState<string[]>([]);
  const [refImages, setRefImages] = useState<UploadAsset[]>([]);
  const refImgInputRef = useRef<HTMLInputElement>(null);
  const [activePoster, setActivePoster] = useState<PosterItem | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState<(typeof RESULT_FILTERS)[number]["id"]>("all");
  const [latestBatchId, setLatestBatchId] = useState<string | null>(null);

  const [proposalText, setProposalText] = useState("");
  const [finalPoster, setFinalPoster] = useState<PosterItem | null>(null);

  const [storage, setStorage] = useState<StorageItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [showStorage, setShowStorage] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedStorage(storage)));
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore storage cleanup failures
      }
      setNotice({
        tone: "error",
        message: "本地存储空间已满，超大图片将只保留在当前会话中。",
      });
    }
  }, [storage]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const addToStorage = useCallback((url: string, label = "海报") => {
    const item = { id: Date.now().toString() + Math.random().toString(36).slice(2), url, label, timestamp: Date.now() };
    setStorage((prev) => [item, ...prev].slice(0, 40));
    if (!isPersistableStorageUrl(url)) {
      setNotice({
        tone: "success",
        message: "结果已加入暂存区，超大图片不会写入本地持久存储。",
      });
    }
    return item;
  }, []);

  const handleMultiAssetUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadAsset[]>>,
  ) => {
    const files = e.target.files ? Array.from<File>(e.target.files) : [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setter((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            mimeType: file.type,
            data: result.split(",")[1],
            url: result,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMultiAssetUpload(e, setRefImages);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice({ tone: "success", message: `已开始下载 ${filename}` });
  };

  const downloadResizedImage = async (
    url: string,
    filename: string,
    size: { width: number; height: number },
  ) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("导出尺寸转换失败"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持导出画布");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = (canvas.width - drawWidth) / 2;
    const dy = (canvas.height - drawHeight) / 2;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("导出文件生成失败");

    const objectUrl = URL.createObjectURL(blob);
    downloadImage(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ tone: "success", message: successMessage });
    } catch {
      setNotice({ tone: "error", message: "复制失败，请检查浏览器权限后重试" });
    }
  };

  const buildDeliveryText = () => {
    const sections = [
      "【项目交付说明】",
      `项目主题：${briefFields.subject || "未填写"}`,
      `目标受众：${briefFields.audience || "未填写"}`,
      `投放场景：${briefFields.channel || "未填写"}`,
      `视觉气质：${briefFields.tone || "未填写"}`,
      `当前风格：${ART_STYLES.find((style) => style.id === selectedStyle)?.label || "未设置"}`,
      `当前定稿：${finalPoster?.ideaText || "尚未标记"}`,
      "",
      "【交付内容】",
      "1. 定稿主视觉 PNG",
      "2. 常用社媒尺寸导出版本",
      "3. 设计提案与传播建议",
      "",
      "【提案内容】",
      proposalText || "暂无提案内容",
    ];

    return sections.join("\n");
  };

  const buildFileBaseName = () => {
    const rawName = briefFields.subject || "poster-project";
    return rawName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
      .slice(0, 24) || "poster-project";
  };

  const getFriendlyErrorMessage = (message: string) => {
    if (message.includes("Failed to fetch") || message.includes("ERR_TIMED_OUT")) {
      return "提案请求超时了。已经切换为更稳的文本提案链路，刷新后再试一次通常就能恢复。";
    }
    if (message.includes("参考链接是网页") || message.includes("参考链接类型不支持") || message.includes("mime type is not supported")) {
      return "当前参考链接不是可直接识别的图片。系统会优先自动提取网页里的主图；如果仍失败，请改用图片直链，或把参考图保存后上传。";
    }
    if (message.includes("模型或接口不存在") || message.includes("模型不可用")) {
      return `当前模型请求失败：${message}。请切换模型后重试。`;
    }
    if (message.includes("请输入需求")) return "还没有填写创意简报，先补充主题或选择模板。";
    if (message.includes("请选择创意")) return "请先选择至少一个创意方向，再开始生成海报。";
    if (message.includes("请选择海报")) return "还没有选中海报版本，先从结果区挑一张继续操作。";
    if (message.includes("请输入反馈")) return "请补充修改意见，或至少选择一个修改重点。";
    if (message.includes("请选择定稿")) return "还没有设定定稿版本，先从结果区标记一张定稿。";
    return message;
  };

  const appendText = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter((prev) => (prev.trim() ? `${prev}${prev.endsWith(" ") ? "" : "，"}${value}` : value));
  };

  const updateBriefField = (key: BriefFieldKey, value: string) => {
    setBriefFields((prev) => ({ ...prev, [key]: value }));
  };

  const applyBriefTemplate = (templateId: string) => {
    const template = BRIEF_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setActiveTemplateId(templateId);
    setBriefFields(template.fields);
    setPrompt(template.prompt);
    if (template.style) setSelectedStyle(template.style);
    if (template.ratio) setSelectedRatio(template.ratio);
  };

  const buildCreativeBrief = () => {
    const lines = [
      briefFields.subject ? `主题: ${briefFields.subject}` : "",
      briefFields.audience ? `受众: ${briefFields.audience}` : "",
      briefFields.channel ? `投放场景: ${briefFields.channel}` : "",
      briefFields.tone ? `风格倾向: ${briefFields.tone}` : "",
      prompt.trim() ? `补充说明: ${prompt.trim()}` : "",
    ].filter(Boolean);

    return lines.join("\n");
  };

  const buildReferenceSearchQuery = () => {
    const subject = referenceSearchInput.trim() || briefFields.subject.trim();
    const keywords = [
      subject,
      briefFields.channel.trim(),
      briefFields.tone.trim(),
      ART_STYLES.find((style) => style.id === selectedStyle)?.label || "",
      "poster design reference",
    ].filter(Boolean);
    return keywords.join(" ");
  };

  const decorateGeneratedPosters = (
    nextPosters: PosterItem[],
    options: { labels?: string[]; sourceLabel: string; sourceType: PosterItem["sourceType"] },
  ) => {
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLatestBatchId(batchId);
    return nextPosters.map((poster, index) => {
      const item = addToStorage(poster.url, options.labels?.[index] || options.sourceLabel);
      return {
        ...poster,
        id: item.id,
        batchId,
        sourceLabel: options.sourceLabel,
        sourceType: options.sourceType,
      };
    });
  };

  const toggleComparePoster = (posterId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(posterId)) return prev.filter((id) => id !== posterId);
      if (prev.length >= 2) return [prev[1], posterId];
      return [...prev, posterId];
    });
  };

  const toggleFeedbackFocus = (focus: string) => {
    setFeedbackFocuses((prev) => (prev.includes(focus) ? prev.filter((item) => item !== focus) : [...prev, focus]));
  };

  const runReferenceSearch = () => {
    const query = buildReferenceSearchQuery();
    if (!query.trim()) {
      setError("请先输入主体或补充简报信息，再开始参考搜索。");
      return;
    }
    setReferenceSearchQuery(query);
    setError("");
  };

  const importReferenceUrl = () => {
    const url = referenceImportUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("请输入有效的参考图片链接。");
      return;
    }
    setStyleRefImages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        name: `参考链接 ${prev.length + 1}`,
      },
    ]);
    setReferenceImportUrl("");
    setNotice({ tone: "success", message: "参考图链接已加入风格参考。" });
    setError("");
  };

  const comparedPosters = compareSelection
    .map((posterId) => posters.find((poster) => poster.id === posterId))
    .filter(Boolean) as PosterItem[];
  const filteredPosters = posters.filter((poster) => {
    if (resultFilter === "all") return true;
    if (resultFilter === "latest") return latestBatchId ? poster.batchId === latestBatchId : false;
    if (resultFilter === "compare") return compareSelection.includes(poster.id);
    if (resultFilter === "final") return finalPoster ? poster.id === finalPoster.id : false;
    return true;
  });
  const projectSummary: SummaryDataItem[] = [
    { label: "主题", value: briefFields.subject || "未填写", emphasize: true },
    { label: "受众", value: briefFields.audience || "未填写" },
    { label: "场景", value: briefFields.channel || "未填写" },
    { label: "气质", value: briefFields.tone || "未填写" },
    { label: "当前风格", value: ART_STYLES.find((style) => style.id === selectedStyle)?.label || "未设置" },
    { label: "当前定稿", value: finalPoster?.ideaText || "尚未选择" },
  ];

  const generateIdeas = async () => {
    const creativeBrief = buildCreativeBrief();
    if (!creativeBrief.trim() && !styleRefImages.length) {
      setError("请输入需求或上传参考图");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText("正在梳理创意方向...");
    setTaskStatus("queued");
    try {
      const result = await runTask<
        { prompt: string; selectedStyle: string; selectedRatio: string; styleRefImages: UploadAsset[]; selectedTextModel: string; ideaCount: number },
        IdeasTaskResult
      >("ideas", {
        prompt: creativeBrief,
        selectedStyle,
        selectedRatio,
        styleRefImages,
        selectedTextModel,
        ideaCount,
      }, {
        onStatusChange: (status) => setTaskStatus(status),
      });
      setIdeas(result.ideas);
      setSelectedIdeas([]);
      setStep(2);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  const directGeneratePosters = async () => {
    const creativeBrief = buildCreativeBrief();
    if (!creativeBrief.trim() && !styleRefImages.length) {
      setError("请输入需求或上传参考图");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText(`正在使用 ${IMAGE_MODELS.find((model) => model.id === selectedModel)?.label || "当前模型"} 直接生成 ${imageCount} 张海报...`);
    setTaskStatus("queued");
    try {
      const result = await runTask<
        {
          selectedIdeas: number[];
          ideas: string[];
          selectedStyle: string;
          selectedRatio: string;
          selectedModel: string;
          imageCount: number;
          referenceImages: UploadAsset[];
        },
        PostersTaskResult
      >(
        "generate-posters",
        {
          selectedIdeas: [0],
          ideas: [creativeBrief || prompt || briefFields.subject || "Poster design"],
          selectedStyle,
          selectedRatio,
          selectedModel,
          imageCount,
          referenceImages: styleRefImages,
        },
        {
          onStatusChange: (status) => setTaskStatus(status),
        },
      );
      const generated = decorateGeneratedPosters(result.posters, {
        labels: result.posters.map((_, index) => `直出海报-v${index + 1}`),
        sourceLabel: "直接出图",
        sourceType: "ideas",
      });
      setPosters((prev) => [...generated, ...prev]);
      setStep(3);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  const optimizeExisting = async () => {
    if (!uploadedPosters.length) {
      setError("请上传海报");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText(`正在优化海报并生成 ${imageCount} 个版本...`);
    setTaskStatus("queued");
    try {
      const result = await runTask<
        {
          uploadedPosters: UploadAsset[];
          optimizeFeedback: string;
          selectedStyle: string;
          selectedRatio: string;
          selectedModel: string;
          imageCount: number;
        },
        PostersTaskResult
      >("optimize-existing", {
        uploadedPosters,
        optimizeFeedback,
        selectedStyle,
        selectedRatio,
        selectedModel,
        imageCount,
      }, {
        onStatusChange: (status) => setTaskStatus(status),
      });
      const generated = decorateGeneratedPosters(result.posters, {
        labels: result.posters.map((_, index) => `优化v${index + 1}`),
        sourceLabel: "原图优化",
        sourceType: "optimize-existing",
      });
      setPosters((prev) => [...generated, ...prev]);
      setStep(3);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  const generatePosters = async () => {
    if (!selectedIdeas.length) {
      setError("请选择创意");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText(`正在生成 ${selectedIdeas.length * imageCount} 张海报...`);
    setTaskStatus("queued");
    try {
      const result = await runTask<
        {
          selectedIdeas: number[];
          ideas: string[];
          selectedStyle: string;
          selectedRatio: string;
          selectedModel: string;
          imageCount: number;
          referenceImages: UploadAsset[];
        },
        PostersTaskResult
      >("generate-posters", {
        selectedIdeas,
        ideas,
        selectedStyle,
        selectedRatio,
        selectedModel,
        imageCount,
        referenceImages: styleRefImages,
      }, {
        onStatusChange: (status) => setTaskStatus(status),
      });
      const generated = decorateGeneratedPosters(result.posters, {
        labels: result.posters.map((_, index) => {
          const ideaIndex = Math.floor(index / imageCount);
          const variationIndex = (index % imageCount) + 1;
          return `创意${selectedIdeas[ideaIndex] + 1}-v${variationIndex}`;
        }),
        sourceLabel: "创意生成",
        sourceType: "ideas",
      });
      setPosters((prev) => [...generated, ...prev]);
      setStep(3);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  const optimizePoster = async () => {
    if (!activePoster) {
      setError("请选择海报");
      return;
    }
    if (!feedbackText.trim() && !feedbackFocuses.length) {
      setError("请输入反馈");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText("正在根据反馈继续打磨...");
    setTaskStatus("queued");
    try {
      const combinedFeedback = [
        feedbackFocuses.length ? `重点调整：${feedbackFocuses.join("、")}` : "",
        feedbackText,
      ]
        .filter(Boolean)
        .join("。");
      const result = await runTask<
        {
          activePoster: PosterItem | null;
          feedbackText: string;
          refImages: UploadAsset[];
          selectedStyle: string;
          selectedRatio: string;
          selectedModel: string;
          imageCount: number;
        },
        PostersTaskResult
      >("optimize-poster", {
        activePoster,
        feedbackText: combinedFeedback,
        refImages,
        selectedStyle,
        selectedRatio,
        selectedModel,
        imageCount,
      }, {
        onStatusChange: (status) => setTaskStatus(status),
      });
      const generated = decorateGeneratedPosters(result.posters, {
        labels: result.posters.map((_, index) => `优化版${index + 1}`),
        sourceLabel: "反馈优化",
        sourceType: "optimize-poster",
      });
      setPosters((prev) => [...generated, ...prev]);
      setFeedbackText("");
      setFeedbackFocuses([]);
      setStep(3);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  const generateProposal = async () => {
    if (!finalPoster) {
      setError("请选择定稿");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText("正在撰写提案...");
    setTaskStatus("queued");
    try {
      const result = await runTask<
        {
          finalPoster: PosterItem | null;
          selectedTextModel: string;
          briefSummary: {
            subject: string;
            audience: string;
            channel: string;
            tone: string;
            prompt: string;
            selectedStyle: string;
            selectedRatio: string;
          };
        },
        ProposalTaskResult
      >(
        "proposal",
        {
          finalPoster,
          selectedTextModel,
          briefSummary: {
            subject: briefFields.subject,
            audience: briefFields.audience,
            channel: briefFields.channel,
            tone: briefFields.tone,
            prompt,
            selectedStyle: ART_STYLES.find((style) => style.id === selectedStyle)?.label || selectedStyle,
            selectedRatio,
          },
        },
        {
          onStatusChange: (status) => setTaskStatus(status),
        },
      );
      setProposalText(result.proposalText);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      {loading ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-6 backdrop-blur-2xl">
          <div className="glass-panel max-w-md rounded-[30px] px-8 py-9 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <RefreshCw className="animate-spin" size={26} />
            </div>
            <p className="mt-5 text-lg font-semibold">{loadingText}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {taskStatus === "queued" && "任务已进入队列，正在准备执行。"}
              {taskStatus === "running" && (selectedModel.startsWith("mj_") ? "Midjourney 任务处理中，建议稍候。" : "任务执行中，正在保持当前工作流上下文。")}
              {taskStatus === "completed" && "任务已经完成，正在整理结果。"}
              {taskStatus === "failed" && "任务执行失败，请检查输入后重试。"}
              {taskStatus === "idle" && "正在保持当前工作流上下文。"}
            </p>
          </div>
        </div>
      ) : null}

      {previewImg ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl"
          onClick={() => setPreviewImg(null)}
        >
          <button className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white">
            <X size={20} />
          </button>
          <img src={previewImg} className="max-h-full max-w-full rounded-[28px] object-contain shadow-2xl" />
        </div>
      ) : null}

      {notice ? (
        <div className="fixed right-6 top-24 z-[95]">
          <div
            className={`glass-panel rounded-[22px] px-4 py-3 text-sm shadow-[var(--shadow-card)] ${
              notice.tone === "success" ? "text-[var(--success-strong)]" : "text-[var(--danger-strong)]"
            }`}
          >
            {notice.message}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1520px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-4 z-50 rounded-[32px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-[var(--shadow-card)]">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                  <MoonStar size={12} />
                  Apple OS 风格工作台
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">AI 海报工坊</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  更像专业创意工具的第一版工作台，支持浅色、深色与系统主题。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <ThemeToggle />

              <div className="relative">
                <button
                  onClick={() => setShowTextModelPicker((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:bg-[var(--surface-strong)]"
                >
                  <FileText size={14} />
                  {TEXT_MODELS.find((model) => model.id === selectedTextModel)?.label}
                  <ChevronDown size={14} />
                </button>
                {showTextModelPicker ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTextModelPicker(false)} />
                    <div className="glass-panel absolute right-0 top-full z-50 mt-3 w-72 rounded-[28px] p-3">
                      <div className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)]">当前文字模型</div>
                      {TEXT_MODELS.map((model) => {
                        const active = model.id === selectedTextModel;
                        return (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedTextModel(model.id);
                              setShowTextModelPicker(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-[20px] px-3 py-3 text-left transition ${
                              active
                                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            <span className="text-sm font-medium">{model.label}</span>
                            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{model.tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowModelPicker((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:bg-[var(--surface-strong)]"
                >
                  <Monitor size={14} />
                  {IMAGE_MODELS.find((model) => model.id === selectedModel)?.label}
                  <ChevronDown size={14} />
                </button>
                {showModelPicker ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                    <div className="glass-panel absolute right-0 top-full z-50 mt-3 w-80 rounded-[28px] p-3">
                      <div className="px-3 py-2 text-xs font-medium text-[var(--text-tertiary)]">当前出图模型</div>
                      {IMAGE_MODELS.map((model) => {
                        const active = model.id === selectedModel;
                        return (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id);
                              setShowModelPicker(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-[20px] px-3 py-3 text-left transition ${
                              active
                                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            <span className="text-sm font-medium">{model.label}</span>
                            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{model.tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>

              <button
                onClick={() => setShowStorage((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:bg-[var(--surface-strong)]"
              >
                <FolderOpen size={14} />
                存储区
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent-strong)]">{storage.length}</span>
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="glass-panel mt-4 flex items-center justify-between gap-4 rounded-[24px] px-5 py-4 text-sm text-[var(--danger-strong)]">
            <span>{error}</span>
            <button onClick={() => setError("")} className="rounded-full bg-[var(--danger-soft)] p-1.5">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <main className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="glass-panel rounded-[30px] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">工作台</p>
                  <h2 className="mt-2 text-lg font-semibold">项目概览</h2>
                </div>
                <ModelPill modelId={selectedModel} />
              </div>

              <div className="space-y-3">
                {[
                  { label: "风格", value: ART_STYLES.find((style) => style.id === selectedStyle)?.label || "未设置" },
                  { label: "画幅", value: selectedRatio },
                  { label: "主题", value: briefFields.subject || "未填写" },
                  { label: "创意", value: `${ideas.length} 个` },
                  { label: "结果", value: `${posters.length} 张` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[18px] bg-[var(--surface-muted)] px-4 py-3">
                    <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <StepRail step={step} labels={STEPS} onChange={(next) => setStep(next)} />

            <div className="glass-panel rounded-[30px] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">工业化建议</p>
              <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                <li>结果区已经支持轻筛选和对比，适合快速做第一轮筛选。</li>
                <li>反馈优化现在可以先选修改重点，再补充自然语言。</li>
                <li>下一轮更适合继续做交付导出，而不是增加复杂编辑结构。</li>
              </ul>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="glass-panel rounded-[32px] p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--accent-strong)]">Creative Workspace</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">让海报生成更像连续创作，而不是跳页表单</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                      这版先完成主题系统、工作台布局和更柔和的 Apple OS 风格层次。业务链路仍然沿用原有逻辑，方便下一步继续做任务化和版本管理。
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition hover:opacity-90"
                    >
                      开始创作
                    </button>
                    <button
                      onClick={() => setShowStorage(true)}
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-strong)]"
                    >
                      打开存储区
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-[32px] p-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Theme Status</p>
                <p className="mt-3 text-2xl font-semibold">{resolvedTheme === "dark" ? "Dark" : "Light"}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">主题切换已抽成全局能力，后续可以继续扩展品牌色和组件 token。</p>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--accent-strong)]">Project Snapshot</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">当前项目状态一目了然</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                    用最少的信息告诉你这个项目正在做什么、面向谁、已经推进到哪一步。
                  </p>
                </div>
                <div className="rounded-[22px] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  当前阶段
                  <span className="ml-2 font-semibold text-[var(--text-primary)]">{STEPS[step - 1]}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {projectSummary.map((item) => (
                  <div key={item.label}>
                    <SummaryItem label={item.label} value={item.value} emphasize={item.emphasize} />
                  </div>
                ))}
              </div>
            </div>

            {showStorage ? (
              <WorkbenchCard title="存储区" subtitle="已保存的海报结果可以继续预览、下载或删除。">
                {!storage.length ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                    <FolderOpen className="mx-auto mb-4" size={34} />
                    暂无海报结果
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {storage.map((item) => (
                      <div key={item.id} className="surface-card overflow-hidden rounded-[24px]">
                        <button className="block aspect-square w-full overflow-hidden" onClick={() => setPreviewImg(item.url)}>
                          <img src={item.url} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                        </button>
                        <div className="space-y-3 p-4">
                          <div>
                            <p className="truncate text-sm font-semibold">{item.label}</p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{new Date(item.timestamp).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => downloadImage(item.url, `${item.label}.png`)}
                              className="flex-1 rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-strong)]"
                            >
                              下载
                            </button>
                            <button
                              onClick={() => setStorage((prev) => prev.filter((entry) => entry.id !== item.id))}
                              className="rounded-full bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger-strong)]"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </WorkbenchCard>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <WorkbenchCard title="从零创作" subtitle="先整理需求、风格和画幅，让模型在更明确的上下文里构思。">
                  <div className="space-y-6">
                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">美术风格</label>
                      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                        {ART_STYLES.map((style) => {
                          const Icon = style.icon;
                          const active = selectedStyle === style.id;
                          return (
                            <button
                              key={style.id}
                              onClick={() => setSelectedStyle(style.id)}
                              className={`rounded-[24px] border p-4 text-left transition ${
                                active
                                  ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                              }`}
                            >
                              <Icon size={18} />
                              <div className="mt-4 text-sm font-semibold">{style.label}</div>
                              <div className="mt-1 text-xs">{style.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">画幅比例</label>
                      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                        {ASPECT_RATIOS.map((ratio) => {
                          const active = selectedRatio === ratio.id;
                          return (
                            <button
                              key={ratio.id}
                              onClick={() => setSelectedRatio(ratio.id)}
                              className={`rounded-[22px] border px-3 py-4 transition ${
                                active
                                  ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                              }`}
                            >
                              <div
                                className={`mx-auto rounded-md border-2 ${active ? "border-[var(--accent-strong)]" : "border-[var(--border-strong)]"}`}
                                style={{
                                  width: `${Math.max(16, (ratio.w / Math.max(ratio.w, ratio.h)) * 28)}px`,
                                  height: `${Math.max(16, (ratio.h / Math.max(ratio.w, ratio.h)) * 28)}px`,
                                }}
                              />
                              <div className="mt-3 text-sm font-semibold">{ratio.id}</div>
                              <div className="mt-1 text-xs">{ratio.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                        生成数量
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">文案数量</p>
                          <div className="flex gap-2">
                            {IDEA_COUNT_OPTIONS.map((count) => (
                              <button
                                key={count}
                                onClick={() => setIdeaCount(count)}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  ideaCount === count
                                    ? "bg-[var(--accent-strong)] text-white"
                                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                                }`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">图片数量</p>
                          <div className="flex gap-2">
                            {IMAGE_COUNT_OPTIONS.map((count) => (
                              <button
                                key={count}
                                onClick={() => setImageCount(count)}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  imageCount === count
                                    ? "bg-[var(--accent-strong)] text-white"
                                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                                }`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                        风格参考
                      </label>
                      <button
                        onClick={() => styleRefInputRef.current?.click()}
                        className="flex w-full items-center gap-4 rounded-[24px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4 text-left transition hover:bg-[var(--surface-strong)]"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          ref={styleRefInputRef}
                          onChange={(e) => handleMultiAssetUpload(e, setStyleRefImages)}
                        />
                        {styleRefImages.length ? (
                          <div className="flex flex-wrap gap-3">
                            {styleRefImages.map((img, index) => (
                              <div key={img.id || `${img.name}-${index}`} className="relative">
                                <img src={img.url} className="h-16 w-16 rounded-[18px] object-cover" />
                                <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white">
                                  {index + 1}
                                </span>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setStyleRefImages((prev) => prev.filter((item) => item.id !== img.id));
                                  }}
                                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--surface-strong)] text-[var(--text-secondary)]">
                              <Upload size={18} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">上传风格参考图（可多张）</div>
                              <div className="mt-1 text-xs text-[var(--text-secondary)]">支持在描述里用 @图1、@图2 指向不同参考图</div>
                            </div>
                          </>
                        )}
                      </button>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                        参考搜索
                      </label>
                      <div className="space-y-3 rounded-[24px] bg-[var(--surface-muted)] p-4">
                        <div className="flex flex-col gap-3 md:flex-row">
                          <input
                            value={referenceSearchInput}
                            onChange={(e) => setReferenceSearchInput(e.target.value)}
                            placeholder="输入你要找的主体，例如：香水、咖啡机、音乐节"
                            className="soft-input flex-1 rounded-[18px] px-4 py-3 text-sm"
                          />
                          <button
                            onClick={runReferenceSearch}
                            className="rounded-full bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-elevated)]"
                          >
                            搜索参考
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                          会结合主体、风格、场景生成搜索词，打开 Pinterest、花瓣、Behance 等站点供客户浏览参考。
                        </p>
                        {referenceSearchQuery ? (
                          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">当前搜索词</p>
                            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{referenceSearchQuery}</p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {REFERENCE_SEARCH_PROVIDERS.map((provider) => (
                                <a
                                  key={provider.id}
                                  href={provider.buildUrl(referenceSearchQuery)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 transition hover:bg-[var(--surface-strong)]"
                                >
                                  <div className="text-sm font-semibold text-[var(--text-primary)]">{provider.label}</div>
                                  <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{provider.description}</div>
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-[18px] border border-dashed border-[var(--border-subtle)] px-4 py-4">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">导入选中的参考图链接</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                            在外部搜索页找到合适图片后，把图片链接粘贴到这里，就能加入上面的风格参考，并继续用 @图 引用。
                          </p>
                          <div className="mt-3 flex flex-col gap-3 md:flex-row">
                            <input
                              value={referenceImportUrl}
                              onChange={(e) => setReferenceImportUrl(e.target.value)}
                              placeholder="粘贴参考图片链接，例如 https://..."
                              className="soft-input flex-1 rounded-[18px] px-4 py-3 text-sm"
                            />
                            <button
                              onClick={importReferenceUrl}
                              className="rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                              加入风格参考
                            </button>
                          </div>
                          {referenceImportHint ? (
                            <p className="mt-3 text-xs text-[var(--accent-strong)]">{referenceImportHint}</p>
                          ) : null}
                          <div className="mt-4 rounded-[16px] bg-[var(--surface-muted)] px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">导入建议</p>
                            <div className="mt-3 space-y-2 text-xs leading-5 text-[var(--text-secondary)]">
                              {REFERENCE_IMPORT_TIPS.map((tip) => (
                                <p key={tip}>{tip}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                        项目模板
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {BRIEF_TEMPLATES.map((template) => {
                          const active = activeTemplateId === template.id;
                          return (
                            <button
                              key={template.id}
                              onClick={() => applyBriefTemplate(template.id)}
                              className={`rounded-[24px] border p-4 text-left transition ${
                                active
                                  ? "border-transparent bg-[var(--accent-soft)]"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:bg-[var(--surface-strong)]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{template.label}</span>
                                {active ? (
                                  <span className="rounded-full bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-medium text-white">
                                    已应用
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{template.description}</p>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-[var(--text-tertiary)]">如果你不想从零开始，先点一个最接近的模板会更快。</p>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                        创意简报
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {BRIEF_FIELD_META.map((field) => (
                          <label key={field.key} className="block">
                            <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{field.label}</span>
                            <input
                              value={briefFields[field.key]}
                              onChange={(e) => updateBriefField(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="soft-input w-full rounded-[20px] px-4 py-3 text-sm"
                            />
                          </label>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                        这 4 项填完就已经足够开始生成，下面的大文本框只做补充。
                      </p>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">内容描述</label>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {QUICK_BRIEF_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => appendText(setPrompt, chip)}
                            className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="补充你还想强调的信息，例如把@图1的产品放进@图2的场景里..."
                        className="soft-input h-36 w-full rounded-[24px] px-5 py-4 text-sm resize-none"
                      />
                      {styleRefImages.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {styleRefImages.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setPrompt((prev) => `${prev}@图${index + 1} `)}
                              className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]"
                            >
                              @图{index + 1}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs text-[var(--text-tertiary)]">如果赶时间，只填上面的简报字段也能直接开始。</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        onClick={generateIdeas}
                        className="w-full rounded-full bg-[var(--accent-strong)] px-5 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition hover:opacity-90"
                      >
                        生成 {ideaCount} 个创意方向
                      </button>
                      <button
                        onClick={directGeneratePosters}
                        className="w-full rounded-full bg-[var(--surface-strong)] px-5 py-3.5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:bg-[var(--surface-elevated)]"
                      >
                        直接出图 × {imageCount}
                      </button>
                    </div>
                  </div>
                </WorkbenchCard>

                <WorkbenchCard
                  title="上传优化"
                  subtitle="已有海报时，直接用当前模型生成 3 个优化方向。"
                  accent="green"
                >
                  <div className="space-y-6">
                    <button
                      onClick={() => uploadPosterRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-6 py-10 text-center transition hover:bg-[var(--surface-strong)]"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        ref={uploadPosterRef}
                        onChange={(e) => handleMultiAssetUpload(e, setUploadedPosters)}
                      />
                      {uploadedPosters.length ? (
                        <div className="flex flex-wrap justify-center gap-3">
                          {uploadedPosters.map((img, index) => (
                            <div key={img.id || `${img.name}-${index}`} className="relative">
                              <img src={img.url} className="h-24 w-24 rounded-[18px] object-cover shadow-[var(--shadow-card)]" />
                              <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white">
                                {index + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <Upload size={24} className="text-[var(--text-secondary)]" />
                          <div className="mt-4 text-sm font-semibold">上传海报原图（可多张）</div>
                          <div className="mt-1 text-xs text-[var(--text-secondary)]">支持在描述里用 @图1、@图2 做组合重构</div>
                        </>
                      )}
                    </button>

                    <textarea
                      value={optimizeFeedback}
                      onChange={(e) => setOptimizeFeedback(e.target.value)}
                      placeholder="例如：把@图1的产品，放在@图2的花园里，并整体更高级..."
                      className="soft-input h-32 w-full rounded-[24px] px-5 py-4 text-sm resize-none"
                    />
                    {uploadedPosters.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {uploadedPosters.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setOptimizeFeedback((prev) => `${prev}@图${index + 1} `)}
                            className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]"
                          >
                            @图{index + 1}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <button
                      onClick={optimizeExisting}
                      disabled={!uploadedPosters.length}
                      className={`w-full rounded-full px-5 py-3.5 text-sm font-semibold transition ${
                        uploadedPosters.length
                          ? "bg-[var(--success-strong)] text-white shadow-[var(--shadow-card)] hover:opacity-90"
                          : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                      }`}
                    >
                      直接优化出图 × {imageCount}
                    </button>
                  </div>
                </WorkbenchCard>
              </div>
            ) : null}

            {step === 2 ? (
              <WorkbenchCard title="选择创意方向" subtitle="先筛方向，再出图，减少一次性等待和无效成本。">
                {!ideas.length ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                    先回到步骤 1 输入需求，再生成创意方向。
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {ideas.map((idea, index) => {
                        const active = selectedIdeas.includes(index);
                        return (
                          <button
                            key={index}
                            onClick={() =>
                              setSelectedIdeas((prev) => (active ? prev.filter((item) => item !== index) : [...prev, index]))
                            }
                            className={`rounded-[26px] border p-5 text-left transition ${
                              active
                                ? "border-transparent bg-[var(--accent-soft)]"
                                : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:bg-[var(--surface-strong)]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold">方向 {index + 1}</span>
                              {active ? <CheckCircle2 size={18} className="text-[var(--accent-strong)]" /> : null}
                            </div>
                            <p className="mt-4 line-clamp-5 text-sm leading-6 text-[var(--text-secondary)]">{idea}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--surface-muted)] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-[var(--text-secondary)]">已选 {selectedIdeas.length} 个创意，将生成 {selectedIdeas.length * imageCount} 张海报。</p>
                      <button
                        onClick={generatePosters}
                        disabled={!selectedIdeas.length}
                        className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                          selectedIdeas.length
                            ? "bg-[var(--accent-strong)] text-white shadow-[var(--shadow-card)]"
                            : "bg-[var(--surface-strong)] text-[var(--text-tertiary)]"
                        }`}
                      >
                        开始生成海报
                      </button>
                    </div>
                  </div>
                )}
              </WorkbenchCard>
            ) : null}

            {step === 3 ? (
              <WorkbenchCard title="海报结果" subtitle="现在已经支持双图对比，方便快速筛掉弱版本并确认下一轮优化方向。">
                {!posters.length ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                    暂无海报结果
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {RESULT_FILTERS.map((filter) => {
                        const active = resultFilter === filter.id;
                        return (
                          <button
                            key={filter.id}
                            onClick={() => setResultFilter(filter.id)}
                            className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                              active
                                ? "bg-[var(--accent-strong)] text-white"
                                : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--surface-muted)] p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">结果筛选工作流</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          先勾选最多 2 张进入对比，再决定继续优化或设为定稿。
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCompareSelection([])}
                          className="rounded-full bg-[var(--surface-strong)] px-4 py-2 text-xs font-medium text-[var(--text-primary)]"
                        >
                          清空对比
                        </button>
                        <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-medium text-[var(--accent-strong)]">
                          已选 {compareSelection.length}/2
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">推荐操作</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {compareSelection.length === 0 && "先选 1 张你最接近目标的海报，继续优化。"}
                        {compareSelection.length === 1 && "已经选中 1 张，可以直接继续优化，或者再选 1 张做对比。"}
                        {compareSelection.length === 2 && "现在最适合并排比较，快速确定哪张更适合定稿。"}
                      </p>
                    </div>

                    {comparedPosters.length > 0 ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {comparedPosters.map((poster, index) => (
                          <div key={poster.id} className="surface-card overflow-hidden rounded-[26px] p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                对比位 {index + 1}
                              </span>
                              <button
                                onClick={() => toggleComparePoster(poster.id)}
                                className="rounded-full bg-[var(--danger-soft)] px-3 py-1.5 text-xs font-medium text-[var(--danger-strong)]"
                              >
                                移出
                              </button>
                            </div>
                            <button className="block w-full overflow-hidden rounded-[22px]" onClick={() => setPreviewImg(poster.url)}>
                              <img src={poster.url} className="aspect-square w-full object-cover" />
                            </button>
                            <p className="mt-3 truncate text-sm font-semibold">{poster.ideaText}</p>
                            <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                              <span>推荐先从两张里选一张继续推进</span>
                              <button
                                onClick={() => setPreviewImg(poster.url)}
                                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[var(--text-primary)]"
                              >
                                <Eye size={12} />
                                预览
                              </button>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  setActivePoster(poster);
                                  setStep(4);
                                }}
                                className="rounded-full bg-[var(--surface-strong)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
                              >
                                继续优化
                              </button>
                              <button
                                onClick={() => {
                                  setFinalPoster(poster);
                                  setStep(5);
                                }}
                                className="rounded-full bg-[var(--accent-strong)] px-3 py-2.5 text-sm font-semibold text-white"
                              >
                                设为定稿
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {!filteredPosters.length ? (
                      <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
                        当前筛选下没有结果，试试切换到其他视图。
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                        {filteredPosters.map((poster) => {
                          const selected = compareSelection.includes(poster.id);
                          return (
                            <div
                              key={poster.id}
                              className={`surface-card overflow-hidden rounded-[24px] border transition ${
                                selected ? "border-[var(--accent-strong)]" : "border-transparent"
                              }`}
                            >
                              <div className="relative">
                                <button className="block aspect-square w-full overflow-hidden" onClick={() => setPreviewImg(poster.url)}>
                                  <img src={poster.url} className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                                </button>
                                <button
                                  onClick={() => toggleComparePoster(poster.id)}
                                  className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-card)] ${
                                    selected
                                      ? "bg-[var(--accent-strong)] text-white"
                                      : "bg-black/45 text-white backdrop-blur-md"
                                  }`}
                                >
                                  {selected ? "已加入对比" : "加入对比"}
                                </button>
                              </div>
                              <div className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="line-clamp-2 text-sm font-semibold">{poster.ideaText}</p>
                                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">先优化，再决定是否定稿</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                                      {poster.sourceLabel || "结果"}
                                    </span>
                                    {poster.batchId === latestBatchId ? (
                                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
                                        本轮
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => {
                                      setActivePoster(poster);
                                      setStep(4);
                                    }}
                                    className="rounded-full bg-[var(--surface-strong)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
                                  >
                                    继续优化
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFinalPoster(poster);
                                      setStep(5);
                                    }}
                                    className="rounded-full bg-[var(--accent-strong)] px-3 py-2.5 text-sm font-semibold text-white"
                                  >
                                    设为定稿
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setPreviewImg(poster.url)}
                                    className="flex-1 rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                  >
                                    <Eye size={12} className="mr-1 inline" />
                                    预览
                                  </button>
                                  <button
                                    onClick={() => downloadImage(poster.url, `poster-${poster.id}.png`)}
                                    className="flex-1 rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                  >
                                    <Download size={12} className="mr-1 inline" />
                                    下载
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </WorkbenchCard>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <WorkbenchCard title="当前版本" subtitle="下一轮可把这里升级为多版本对比与分支管理。">
                  {activePoster ? (
                    <div className="overflow-hidden rounded-[28px] bg-[var(--surface-muted)] p-4">
                      <img
                        src={activePoster.url}
                        className="w-full rounded-[24px] object-cover shadow-[var(--shadow-card)]"
                        onClick={() => setPreviewImg(activePoster.url)}
                      />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                          {activePoster.sourceLabel || "结果"}
                        </span>
                        {activePoster.batchId === latestBatchId ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]">
                            来自本轮
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                      先从结果区选择一张海报再继续优化。
                    </div>
                  )}
                </WorkbenchCard>

                <WorkbenchCard title="反馈优化" subtitle="支持上传参考图，并用 @图1 这类方式在指令中引用。">
                  <div className="space-y-5">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">参考图</label>
                        <button
                          onClick={() => refImgInputRef.current?.click()}
                          className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
                        >
                          <Plus size={12} className="mr-1 inline" />
                          添加
                        </button>
                        <input type="file" accept="image/*" multiple className="hidden" ref={refImgInputRef} onChange={handleMultiFileUpload} />
                      </div>
                      {refImages.length ? (
                        <div className="flex flex-wrap gap-3">
                          {refImages.map((img, index) => (
                            <div key={img.id} className="relative">
                              <img src={img.url} className="h-20 w-20 rounded-[18px] object-cover" />
                              <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-strong)] text-xs font-semibold text-white">
                                {index + 1}
                              </span>
                              <button
                                onClick={() => setRefImages((prev) => prev.filter((item) => item.id !== img.id))}
                                className="absolute -right-2 -top-2 rounded-full bg-[var(--danger-strong)] p-1 text-white"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => refImgInputRef.current?.click()}
                          className="w-full rounded-[24px] border border-dashed border-[var(--border-subtle)] px-4 py-10 text-sm text-[var(--text-secondary)]"
                        >
                          上传参考图（可多张）
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">修改意见</label>
                      <div className="mb-3">
                        <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">修改重点</p>
                        <div className="flex flex-wrap gap-2">
                          {FEEDBACK_FOCUS_OPTIONS.map((focus) => {
                            const active = feedbackFocuses.includes(focus);
                            return (
                              <button
                                key={focus}
                                onClick={() => toggleFeedbackFocus(focus)}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                  active
                                    ? "bg-[var(--accent-strong)] text-white"
                                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
                                }`}
                              >
                                {focus}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {QUICK_FEEDBACK_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => appendText(setFeedbackText, chip)}
                            className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="例如：提高高级感，把 @图1 的主体替换进当前画面..."
                        className="soft-input h-40 w-full rounded-[24px] px-5 py-4 text-sm resize-none"
                      />
                      {refImages.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {refImages.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setFeedbackText((prev) => `${prev}@图${index + 1} `)}
                              className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]"
                            >
                              @图{index + 1}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={optimizePoster}
                      disabled={!activePoster || (!feedbackText.trim() && !feedbackFocuses.length)}
                      className={`w-full rounded-full px-5 py-3.5 text-sm font-semibold transition ${
                        activePoster && (feedbackText.trim() || feedbackFocuses.length)
                          ? "bg-[var(--accent-strong)] text-white shadow-[var(--shadow-card)]"
                          : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                      }`}
                    >
                      优化生成 × {imageCount}
                    </button>
                  </div>
                </WorkbenchCard>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <WorkbenchCard title="定稿画布" subtitle="这里已经具备定稿查看、常用尺寸导出和基础交付整理。">
                  {finalPoster ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-[28px] bg-[var(--surface-muted)] p-4">
                        <img
                          src={finalPoster.url}
                          className="w-full rounded-[24px] object-contain shadow-[var(--shadow-card)]"
                          onClick={() => setPreviewImg(finalPoster.url)}
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => downloadImage(finalPoster.url, `${buildFileBaseName()}-master.png`)}
                          className="rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white"
                        >
                          <Download size={14} className="mr-2 inline" />
                          下载定稿
                        </button>
                        <button
                          onClick={() => copyText(buildDeliveryText(), "交付说明已复制")}
                          className="rounded-full bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)]"
                        >
                          <Copy size={14} className="mr-2 inline" />
                          复制交付说明
                        </button>
                        <button
                          onClick={() => setStep(3)}
                          className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)]"
                        >
                          返回结果区
                        </button>
                      </div>

                      <div className="rounded-[24px] bg-[var(--surface-muted)] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold">常用导出规格</h3>
                          <span className="text-xs text-[var(--text-tertiary)]">一键生成常用交付尺寸</span>
                        </div>
                        <div className="mb-3 rounded-[18px] bg-[var(--surface-strong)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                          导出时会按目标尺寸等比缩放原图，并自动补白，不会强行裁切主体。
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {EXPORT_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={async () => {
                                try {
                                  await downloadResizedImage(finalPoster.url, `${buildFileBaseName()}-${preset.suffix}.png`, preset);
                                } catch (err: any) {
                                  setNotice({ tone: "error", message: err.message || "导出失败，请重试" });
                                }
                              }}
                              className="rounded-[20px] bg-[var(--surface-strong)] px-4 py-3 text-left transition hover:bg-white"
                            >
                              <div className="text-sm font-semibold text-[var(--text-primary)]">{preset.label}</div>
                              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                                {preset.width} × {preset.height}
                              </div>
                              <div className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">{preset.usage}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] bg-[var(--surface-muted)] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold">交付清单</h3>
                          <span className="text-xs text-[var(--text-tertiary)]">当前版本的基础交付内容</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[20px] bg-[var(--surface-strong)] px-4 py-3">
                            <div className="text-sm font-semibold">定稿图</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">原始定稿 PNG 与常用尺寸导出</div>
                          </div>
                          <div className="rounded-[20px] bg-[var(--surface-strong)] px-4 py-3">
                            <div className="text-sm font-semibold">提案说明</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">设计理念、传播策略与应用建议</div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-[18px] bg-[var(--surface-strong)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                          推荐交付顺序：先下载定稿主文件，再按渠道导出规格图，最后复制交付说明发给客户或同事。
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                      先在结果区标记一张定稿海报。
                    </div>
                  )}
                </WorkbenchCard>

                <WorkbenchCard title="提案输出" subtitle="仍保留原有提案生成逻辑，界面改成更像交付面板。">
                  {!proposalText ? (
                    <div className="rounded-[24px] bg-[var(--surface-muted)] p-6 text-center">
                      <FileText className="mx-auto text-[var(--text-secondary)]" size={32} />
                      <p className="mt-4 text-base font-semibold">生成专业提案说明</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">自动输出设计理念、视觉分析、传播策略与优化方向。</p>
                      <button
                        onClick={generateProposal}
                        disabled={!finalPoster}
                        className={`mt-6 rounded-full px-5 py-3 text-sm font-semibold transition ${
                          finalPoster
                            ? "bg-[var(--accent-strong)] text-white shadow-[var(--shadow-card)]"
                            : "bg-[var(--surface-strong)] text-[var(--text-tertiary)]"
                        }`}
                      >
                        生成提案
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[24px] bg-[var(--surface-muted)] p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-semibold">提案内容</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyText(proposalText, "提案内容已复制")}
                            className="rounded-full bg-[var(--surface-strong)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                          >
                            <Copy size={12} className="mr-1 inline" />
                            复制提案
                          </button>
                          <button
                            onClick={() => copyText(buildDeliveryText(), "交付说明已复制")}
                            className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent-strong)]"
                          >
                            <Copy size={12} className="mr-1 inline" />
                            复制交付说明
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto text-sm leading-7 text-[var(--text-secondary)]">
                        {proposalText.split("\n").map((line, index) => (
                          <p key={index} className={line.startsWith("#") || line.startsWith("**") ? "font-semibold text-[var(--text-primary)]" : ""}>
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-[24px] bg-[var(--surface-muted)] p-4">
                    <h3 className="text-sm font-semibold">交付建议</h3>
                    <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                      <li>先导出原始定稿，再根据投放平台选择最贴近的规格版本。</li>
                      <li>复制交付说明时，会自动带上项目背景、交付内容和提案正文。</li>
                      <li>如果需要发给客户或同事，优先使用“复制交付说明”配合定稿图一起发送。</li>
                    </ul>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        setProposalText("");
                        generateProposal();
                      }}
                      disabled={!finalPoster}
                      className="flex-1 rounded-full bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"
                    >
                      <RefreshCw size={14} className="mr-2 inline" />
                      重新生成
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="flex-1 rounded-full bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"
                    >
                      返回结果区
                    </button>
                  </div>
                </WorkbenchCard>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
