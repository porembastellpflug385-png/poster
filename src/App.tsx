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

const STEPS = ["需求输入", "初稿生成", "逐稿反馈", "重新生成"];
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
const MAX_STYLE_REFERENCE_COUNT = 4;
const MAX_TASK_PAYLOAD_BYTES = 4.5 * 1024 * 1024;
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
const REFERENCE_SEARCH_TEMPLATES = [
  { id: "brand", label: "高级品牌海报", suffix: "luxury brand poster design" },
  { id: "product", label: "产品主视觉", suffix: "product poster key visual" },
  { id: "campaign", label: "活动宣传海报", suffix: "campaign poster design" },
  { id: "social", label: "社媒封面", suffix: "social media poster design" },
] as const;
const COPY_LAYOUT_OPTIONS = [
  {
    id: "without-copy",
    label: "无文案排版",
    description: "画面中不允许出现任何文字、数字、水印或 logo 文案。",
  },
  {
    id: "with-copy",
    label: "有文案排版",
    description: "先生成适合排版的背景，再用可编辑覆盖层放置标题、正文、二维码和 logo。",
  },
] as const;

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
  generationStage?: "initial" | "refined";
  fromPosterId?: string;
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

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(
  file: File,
  options: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    preservePng?: boolean;
  },
): Promise<UploadAsset> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadCanvasImage(dataUrl);
  const scale = Math.min(1, options.maxWidth / image.width, options.maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("浏览器不支持图片压缩");
  }

  if (options.preservePng && file.type === "image/png") {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(image, 0, 0, width, height);
  const outputType = options.preservePng && file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, options.quality));
  if (!blob) {
    throw new Error("图片压缩失败");
  }
  const compressedUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("压缩结果读取失败"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mimeType: outputType,
    data: compressedUrl.split(",")[1],
    url: compressedUrl,
    name: file.name,
  };
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

type FeedbackDraft = {
  text: string;
  count: (typeof IMAGE_COUNT_OPTIONS)[number];
};

type CopyLayoutMode = (typeof COPY_LAYOUT_OPTIONS)[number]["id"];
type CopyOverlayType = "headline" | "subheadline" | "body" | "note" | "qr" | "logo";
type CopyFields = {
  headline: string;
  subheadline: string;
  body: string;
  note: string;
};
type OverlayElement = {
  id: string;
  type: CopyOverlayType;
  x: number;
  y: number;
  width: number;
  fontSize?: number;
  assetUrl?: string;
  text?: string;
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
type GenerationSnapshot = {
  mode: "ideas" | "direct" | "optimize-existing" | "optimize-poster";
  summary: string;
} | null;

function buildDefaultOverlays(copyFields: CopyFields, qrAsset: UploadAsset | null, logoAsset: UploadAsset | null): OverlayElement[] {
  const overlays: OverlayElement[] = [];
  if (copyFields.headline.trim()) {
    overlays.push({ id: "headline", type: "headline", x: 8, y: 10, width: 54, fontSize: 58, text: copyFields.headline.trim() });
  }
  if (copyFields.subheadline.trim()) {
    overlays.push({ id: "subheadline", type: "subheadline", x: 8, y: 24, width: 52, fontSize: 28, text: copyFields.subheadline.trim() });
  }
  if (copyFields.body.trim()) {
    overlays.push({ id: "body", type: "body", x: 8, y: 35, width: 46, fontSize: 18, text: copyFields.body.trim() });
  }
  if (copyFields.note.trim()) {
    overlays.push({ id: "note", type: "note", x: 8, y: 88, width: 42, fontSize: 14, text: copyFields.note.trim() });
  }
  if (logoAsset?.url) {
    overlays.push({ id: "logo", type: "logo", x: 78, y: 8, width: 14, assetUrl: logoAsset.url });
  }
  if (qrAsset?.url) {
    overlays.push({ id: "qr", type: "qr", x: 78, y: 78, width: 14, assetUrl: qrAsset.url });
  }
  return overlays;
}

function cloneOverlays(overlays: OverlayElement[]) {
  return overlays.map((overlay) => ({ ...overlay }));
}

function formatCopyLayoutSummary(mode: CopyLayoutMode, overlays: OverlayElement[]) {
  if (mode === "without-copy") {
    return "纯视觉海报 · 画面不含任何文字元素";
  }
  return `可编辑文案排版 · ${overlays.length} 个版式元素`;
}

async function loadCanvasImage(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.referrerPolicy = "no-referrer";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("图片加载失败，无法导出合成结果"));
    image.src = url;
  });

  return image;
}

function PosterComposite({
  posterUrl,
  overlays,
  onOverlayPointerDown,
  onSelectOverlay,
  selectedOverlayId,
  editable = false,
}: {
  posterUrl: string;
  overlays: OverlayElement[];
  onOverlayPointerDown?: (event: React.PointerEvent<HTMLDivElement>, overlayId: string) => void;
  onSelectOverlay?: (overlayId: string) => void;
  selectedOverlayId?: string | null;
  editable?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-[var(--surface-muted)]">
      <img src={posterUrl} className="block w-full object-cover" />
      <div className="pointer-events-none absolute inset-0">
        {overlays.map((overlay) => {
          const commonStyle: React.CSSProperties = {
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            width: `${overlay.width}%`,
          };
          const selected = editable && selectedOverlayId === overlay.id;
          const className = `absolute pointer-events-auto ${selected ? "ring-2 ring-[var(--accent-strong)] ring-offset-2 ring-offset-transparent" : ""}`;

          if (overlay.type === "logo" || overlay.type === "qr") {
            return (
              <div
                key={overlay.id}
                style={commonStyle}
                onPointerDown={editable && onOverlayPointerDown ? (event) => onOverlayPointerDown(event, overlay.id) : undefined}
                onClick={() => onSelectOverlay?.(overlay.id)}
                className={className}
              >
                <img src={overlay.assetUrl} className="block w-full rounded-[12px] object-contain shadow-[var(--shadow-card)]" />
              </div>
            );
          }

          const textStyle: React.CSSProperties = {
            ...commonStyle,
            fontSize: `clamp(12px, ${overlay.fontSize || 18}px, 72px)`,
          };

          return (
            <div
              key={overlay.id}
              style={textStyle}
              onPointerDown={editable && onOverlayPointerDown ? (event) => onOverlayPointerDown(event, overlay.id) : undefined}
              onClick={() => onSelectOverlay?.(overlay.id)}
              className={`${className} rounded-[14px] px-2 py-1 text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]`}
            >
              <div
                className={`whitespace-pre-wrap break-words ${
                  overlay.type === "headline"
                    ? "font-semibold leading-[1.05]"
                    : overlay.type === "subheadline"
                      ? "font-medium leading-[1.2]"
                      : "leading-[1.4]"
                }`}
              >
                {overlay.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [copyLayoutMode, setCopyLayoutMode] = useState<CopyLayoutMode>("without-copy");
  const [copyFields, setCopyFields] = useState<CopyFields>({
    headline: "",
    subheadline: "",
    body: "",
    note: "",
  });
  const [prompt, setPrompt] = useState("");
  const [productImage, setProductImage] = useState<UploadAsset | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const [styleRefImages, setStyleRefImages] = useState<UploadAsset[]>([]);
  const styleRefInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [referenceSearchInput, setReferenceSearchInput] = useState("");
  const [referenceSearchQuery, setReferenceSearchQuery] = useState("");
  const [referenceImportUrl, setReferenceImportUrl] = useState("");
  const [activeReferenceTemplateId, setActiveReferenceTemplateId] = useState<string | null>(null);
  const [qrAsset, setQrAsset] = useState<UploadAsset | null>(null);
  const [logoAsset, setLogoAsset] = useState<UploadAsset | null>(null);

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
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, FeedbackDraft>>({});
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFocuses, setFeedbackFocuses] = useState<string[]>([]);
  const [refImages, setRefImages] = useState<UploadAsset[]>([]);
  const refImgInputRef = useRef<HTMLInputElement>(null);
  const [activePoster, setActivePoster] = useState<PosterItem | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState<(typeof RESULT_FILTERS)[number]["id"]>("all");
  const [latestBatchId, setLatestBatchId] = useState<string | null>(null);
  const [latestRefinedSourceId, setLatestRefinedSourceId] = useState<string | null>(null);

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
  const [generationSnapshot, setGenerationSnapshot] = useState<GenerationSnapshot>(null);
  const [posterOverlays, setPosterOverlays] = useState<Record<string, OverlayElement[]>>({});
  const [editingPosterId, setEditingPosterId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    posterId: string;
    overlayId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    containerRect: DOMRect;
  } | null>(null);

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

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dx = ((event.clientX - drag.startX) / drag.containerRect.width) * 100;
      const dy = ((event.clientY - drag.startY) / drag.containerRect.height) * 100;
      setPosterOverlays((prev) => {
        const list = prev[drag.posterId];
        if (!list) return prev;
        return {
          ...prev,
          [drag.posterId]: list.map((overlay) =>
            overlay.id === drag.overlayId
              ? {
                  ...overlay,
                  x: Math.max(0, Math.min(100 - overlay.width, drag.initialX + dx)),
                  y: Math.max(0, Math.min(100, drag.initialY + dy)),
                }
              : overlay,
          ),
        };
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

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

  const compressUploadFile = useCallback(async (file: File, kind: "product" | "style" | "qr" | "logo") => {
    if (!file.type.startsWith("image/")) {
      throw new Error("仅支持上传图片文件");
    }
    const config =
      kind === "product"
        ? { maxWidth: 1600, maxHeight: 1600, quality: 0.84, preservePng: false }
        : kind === "style"
          ? { maxWidth: 1200, maxHeight: 1200, quality: 0.78, preservePng: false }
          : { maxWidth: 720, maxHeight: 720, quality: 0.92, preservePng: true };
    return compressImageFile(file, config);
  }, []);

  const handleMultiAssetUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadAsset[]>>,
    kind: "style" | "qr" | "logo" | "product" = "style",
  ) => {
    const files = e.target.files ? Array.from<File>(e.target.files) : [];
    const allowedFiles = kind === "style" ? files.slice(0, MAX_STYLE_REFERENCE_COUNT) : files;
    Promise.all(allowedFiles.map((file) => compressUploadFile(file, kind))).then((assets) => {
      setter((prev) => {
        const next = [...prev, ...assets];
        return kind === "style" ? next.slice(0, MAX_STYLE_REFERENCE_COUNT) : next;
      });
      if (kind === "style" && files.length > MAX_STYLE_REFERENCE_COUNT) {
        setNotice({ tone: "error", message: `风格参考最多保留 ${MAX_STYLE_REFERENCE_COUNT} 张。` });
      }
    }).catch((error: any) => {
      setError(error?.message || "图片处理失败，请重试");
    });
    e.target.value = "";
  };

  const handleMultiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMultiAssetUpload(e, setRefImages, "style");
  };

  const handleSingleAssetUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadAsset | null>>,
    kind: "product" | "qr" | "logo",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressUploadFile(file, kind)
      .then((asset) => setter(asset))
      .catch((error: any) => setError(error?.message || "图片处理失败，请重试"));
    e.target.value = "";
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

  const renderPosterWithOverlays = async (
    posterUrl: string,
    overlays: OverlayElement[],
    outputSize?: { width: number; height: number },
  ) => {
    const image = await loadCanvasImage(posterUrl);
    const width = outputSize?.width || image.width;
    const height = outputSize?.height || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("浏览器不支持导出画布");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const baseScale = Math.min(width / image.width, height / image.height);
    const baseWidth = image.width * baseScale;
    const baseHeight = image.height * baseScale;
    const baseX = (width - baseWidth) / 2;
    const baseY = (height - baseHeight) / 2;
    ctx.drawImage(image, baseX, baseY, baseWidth, baseHeight);

    for (const overlay of overlays) {
      const x = baseX + (overlay.x / 100) * baseWidth;
      const y = baseY + (overlay.y / 100) * baseHeight;
      const overlayWidth = (overlay.width / 100) * baseWidth;

      if ((overlay.type === "logo" || overlay.type === "qr") && overlay.assetUrl) {
        const assetImage = await loadCanvasImage(overlay.assetUrl);
        const assetHeight = overlayWidth * (assetImage.height / assetImage.width);
        ctx.drawImage(assetImage, x, y, overlayWidth, assetHeight);
        continue;
      }

      if (!overlay.text) continue;
      const fontSize = (overlay.fontSize || 18) * (baseWidth / 1200);
      ctx.font = `${overlay.type === "headline" ? "700" : overlay.type === "subheadline" ? "600" : "500"} ${fontSize}px "SF Pro Display", "Helvetica Neue", sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 4;

      const lineHeight = fontSize * (overlay.type === "headline" ? 1.08 : 1.35);
      const charsPerLine = Math.max(6, Math.floor(overlayWidth / Math.max(fontSize * 0.62, 10)));
      const paragraphs = overlay.text.split("\n");
      let currentY = y;
      paragraphs.forEach((paragraph) => {
        const lines = paragraph.match(new RegExp(`.{1,${charsPerLine}}`, "g")) || [paragraph];
        lines.forEach((line) => {
          ctx.fillText(line, x, currentY, overlayWidth);
          currentY += lineHeight;
        });
      });
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) {
      throw new Error("导出文件生成失败");
    }
    return blob;
  };

  const downloadPosterAsset = async (
    posterUrl: string,
    filename: string,
    overlays: OverlayElement[] = [],
    outputSize?: { width: number; height: number },
  ) => {
    if (!overlays.length) {
      if (!outputSize) {
        downloadImage(posterUrl, filename);
        return;
      }
      await downloadResizedImage(posterUrl, filename, outputSize);
      return;
    }

    const blob = await renderPosterWithOverlays(posterUrl, overlays, outputSize);
    const objectUrl = URL.createObjectURL(blob);
    downloadImage(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
    if (message.includes("413") || message.includes("上传内容过大")) {
      return "上传内容过大。系统已经先做了压缩，如果仍超限，请减少风格参考数量，或换更小的图片后重试。";
    }
    if (message.includes("Failed to fetch") || message.includes("ERR_TIMED_OUT")) {
      return "请求超时了。请先重试一次；如果仍失败，优先减少参考图数量或切换更快的模型。";
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

  const buildCopyPrompt = () => {
    if (copyLayoutMode === "without-copy") {
      return "版式要求：画面中绝对不允许出现任何文字、数字、logo 文案、水印、招牌或可识别字符。";
    }
    const contentLines = [
      copyFields.headline ? `主标题：${copyFields.headline}` : "",
      copyFields.subheadline ? `副标题：${copyFields.subheadline}` : "",
      copyFields.body ? `正文：${copyFields.body}` : "",
      copyFields.note ? `备注：${copyFields.note}` : "",
      qrAsset ? "需要二维码位" : "",
      logoAsset ? "需要 logo 位" : "",
    ].filter(Boolean);
    return [
      "版式要求：需要有文案排版空间，但不要在海报背景里硬生成真实文字。",
      "请预留清晰、专业、可编辑的文案安全区，后续文案将由前端覆盖层叠加。",
      contentLines.length ? `排版内容参考：${contentLines.join("；")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const assertTaskPayloadSize = (type: string, payload: unknown) => {
    const bytes = new Blob([JSON.stringify({ type, payload })]).size;
    if (bytes > MAX_TASK_PAYLOAD_BYTES) {
      throw new Error("上传内容过大，已超过生成请求上限。请减少参考图数量，或使用更小的图片后重试。");
    }
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

  const buildGenerationSnapshot = (mode: NonNullable<GenerationSnapshot>["mode"]) => {
    const styleLabel = ART_STYLES.find((style) => style.id === selectedStyle)?.label || selectedStyle;
    const brief = [briefFields.subject, briefFields.channel, briefFields.tone].filter(Boolean).join(" / ") || "未填写简报";
    const references = styleRefImages.length ? `参考图 ${styleRefImages.length} 张` : "未使用参考图";
    const copySummary = formatCopyLayoutSummary(copyLayoutMode, buildDefaultOverlays(copyFields, qrAsset, logoAsset));
    return {
      mode,
      summary: `${styleLabel} · ${selectedRatio} · ${references} · ${copySummary} · ${brief}`,
    };
  };

  const assignOverlaysToPosters = (items: PosterItem[]) => {
    if (copyLayoutMode !== "with-copy") return;
    const baseOverlays = buildDefaultOverlays(copyFields, qrAsset, logoAsset);
    if (!baseOverlays.length) return;
    setPosterOverlays((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.id] = cloneOverlays(baseOverlays);
      });
      return next;
    });
  };

  const initializeFeedbackDrafts = (items: PosterItem[]) => {
    setFeedbackDrafts((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.id] = next[item.id] || { text: "", count: 1 };
      });
      return next;
    });
  };

  const openOverlayEditor = (poster: PosterItem) => {
    setEditingPosterId(poster.id);
    setSelectedOverlayId((posterOverlays[poster.id] && posterOverlays[poster.id][0]?.id) || null);
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

  const applyReferenceSearchTemplate = (templateId: string) => {
    const template = REFERENCE_SEARCH_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const subject = referenceSearchInput.trim() || briefFields.subject.trim() || "poster";
    setActiveReferenceTemplateId(templateId);
    setReferenceSearchInput(subject);
    setReferenceSearchQuery([subject, briefFields.channel.trim(), briefFields.tone.trim(), template.suffix].filter(Boolean).join(" "));
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
  const editingPoster = editingPosterId ? posters.find((poster) => poster.id === editingPosterId) || null : null;
  const editingOverlays = editingPosterId ? posterOverlays[editingPosterId] || [] : [];
  const selectedOverlay = editingOverlays.find((overlay) => overlay.id === selectedOverlayId) || null;
  const initialPosters = posters.filter((poster) => !poster.fromPosterId);
  const refinedPosters = posters.filter((poster) => Boolean(poster.fromPosterId));
  const refinedGroups = initialPosters
    .map((poster) => ({
      sourcePoster: poster,
      results: refinedPosters.filter((item) => item.fromPosterId === poster.id),
    }))
    .filter((group) => group.results.length > 0);
  const filteredPosters = posters.filter((poster) => {
    if (resultFilter === "all") return true;
    if (resultFilter === "latest") return latestBatchId ? poster.batchId === latestBatchId : false;
    if (resultFilter === "compare") return compareSelection.includes(poster.id);
    if (resultFilter === "final") return finalPoster ? poster.id === finalPoster.id : false;
    return true;
  });
  const projectSummary: SummaryDataItem[] = [
    { label: "文字需求", value: prompt.trim() ? prompt.trim().slice(0, 24) : "未填写", emphasize: true },
    { label: "产品图", value: productImage ? "已上传" : "未上传" },
    { label: "风格参考", value: `${styleRefImages.length} 张` },
    { label: "输出尺寸", value: selectedRatio },
    { label: "海报风格", value: ART_STYLES.find((style) => style.id === selectedStyle)?.label || "未设置" },
    { label: "初稿", value: `${initialPosters.length} 张` },
    { label: "修改稿", value: `${refinedPosters.length} 张` },
  ];

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>, posterId: string, overlayId: string) => {
    const container = event.currentTarget.closest("[data-overlay-stage]");
    if (!container) return;
    const overlay = (posterOverlays[posterId] || []).find((item) => item.id === overlayId);
    if (!overlay) return;
    dragStateRef.current = {
      posterId,
      overlayId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: overlay.x,
      initialY: overlay.y,
      containerRect: container.getBoundingClientRect(),
    };
    setSelectedOverlayId(overlayId);
  };

  const updateSelectedOverlay = (patch: Partial<OverlayElement>) => {
    if (!editingPosterId || !selectedOverlayId) return;
    setPosterOverlays((prev) => ({
      ...prev,
      [editingPosterId]: (prev[editingPosterId] || []).map((overlay) =>
        overlay.id === selectedOverlayId ? { ...overlay, ...patch } : overlay,
      ),
    }));
  };

  const updateFeedbackDraft = (posterId: string, patch: Partial<FeedbackDraft>) => {
    setFeedbackDrafts((prev) => ({
      ...prev,
      [posterId]: {
        text: "",
        count: 1,
        ...prev[posterId],
        ...patch,
      },
    }));
  };

  const generateIdeas = async () => {
    const creativeBrief = [buildCreativeBrief(), buildCopyPrompt()].filter(Boolean).join("\n");
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
        {
          prompt: string;
          selectedStyle: string;
          selectedRatio: string;
          styleRefImages: UploadAsset[];
          selectedTextModel: string;
          ideaCount: number;
        },
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
      setGenerationSnapshot(buildGenerationSnapshot("ideas"));
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
    const creativeBrief = [buildCreativeBrief(), buildCopyPrompt()].filter(Boolean).join("\n");
    if (!creativeBrief.trim() && !styleRefImages.length && !productImage) {
      setError("请至少输入文字需求，或上传产品图 / 风格参考。");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText(`正在使用 ${IMAGE_MODELS.find((model) => model.id === selectedModel)?.label || "当前模型"} 生成 ${imageCount} 张初稿...`);
    setTaskStatus("queued");
    try {
      const payload = {
        selectedIdeas: [0],
        ideas: [creativeBrief || prompt || briefFields.subject || "Poster design"],
        selectedStyle,
        selectedRatio,
        selectedModel,
        imageCount,
        referenceImages: styleRefImages,
        productImage,
        copyLayoutMode,
        copyFields,
      };
      assertTaskPayloadSize("generate-posters", payload);
      const result = await runTask<
        {
          selectedIdeas: number[];
          ideas: string[];
          selectedStyle: string;
          selectedRatio: string;
          selectedModel: string;
          imageCount: number;
          referenceImages: UploadAsset[];
          productImage: UploadAsset | null;
          copyLayoutMode: CopyLayoutMode;
          copyFields: CopyFields;
        },
        PostersTaskResult
      >(
        "generate-posters",
        payload,
        {
          onStatusChange: (status) => setTaskStatus(status),
        },
      );
      const generated = decorateGeneratedPosters(result.posters, {
        labels: result.posters.map((_, index) => `初稿 ${index + 1}`),
        sourceLabel: "初稿生成",
        sourceType: "ideas",
      }).map((item) => ({ ...item, generationStage: "initial" as const }));
      setPosters(generated);
      setFeedbackDrafts({});
      initializeFeedbackDrafts(generated);
      assignOverlaysToPosters(generated);
      setLatestRefinedSourceId(null);
      setActivePoster(generated[0] || null);
      setGenerationSnapshot(buildGenerationSnapshot("direct"));
      setStep(2);
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
      setGenerationSnapshot({
        mode: "optimize-existing",
        summary: `${uploadedPosters.length} 张原图 · ${selectedRatio} · ${imageCount} 个优化版本`,
      });
      setStep(3);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message));
      setTaskStatus("failed");
    } finally {
      setTaskStatus("idle");
      setLoading(false);
    }
  };

  const regeneratePoster = async (poster: PosterItem) => {
    const draft = feedbackDrafts[poster.id] || { text: "", count: 1 as const };
    if (!draft.text.trim()) {
      setError("请先输入修改需求，再重新生成。");
      return;
    }
    setLoading(true);
    setError("");
    setLoadingText(`正在基于这张初稿重新生成 ${draft.count} 个画面...`);
    setTaskStatus("queued");
    try {
      const payload = {
        activePoster: poster,
        feedbackText: draft.text,
        refImages: styleRefImages,
        referenceImages: styleRefImages,
        productImage,
        selectedStyle,
        selectedRatio,
        selectedModel,
        imageCount: draft.count,
        fromPosterId: poster.id,
        copyLayoutMode,
        copyFields,
      };
      assertTaskPayloadSize("optimize-poster", payload);
      const result = await runTask<
        {
          activePoster: PosterItem | null;
          feedbackText: string;
          refImages: UploadAsset[];
          referenceImages: UploadAsset[];
          productImage: UploadAsset | null;
          selectedStyle: string;
          selectedRatio: string;
          selectedModel: string;
          imageCount: number;
          fromPosterId: string;
          copyLayoutMode: CopyLayoutMode;
          copyFields: CopyFields;
        },
        PostersTaskResult
      >("optimize-poster", payload, {
        onStatusChange: (status) => setTaskStatus(status),
      });
      const generated = decorateGeneratedPosters(result.posters, {
        labels: result.posters.map((_, index) => `修改稿 ${index + 1}`),
        sourceLabel: "修改生成",
        sourceType: "optimize-poster",
      }).map((item) => ({
        ...item,
        generationStage: "refined" as const,
        fromPosterId: poster.id,
      }));
      setPosters((prev) => [...generated, ...prev]);
      if (copyLayoutMode === "with-copy") {
        const sourceOverlays = posterOverlays[poster.id] || buildDefaultOverlays(copyFields, qrAsset, logoAsset);
        setPosterOverlays((prev) => {
          const next = { ...prev };
          generated.forEach((item) => {
            next[item.id] = cloneOverlays(sourceOverlays);
          });
          return next;
        });
      }
      setLatestRefinedSourceId(poster.id);
      setGenerationSnapshot({
        mode: "optimize-poster",
        summary: `基于「${poster.ideaText}」修改生成 ${generated.length} 张 · ${draft.text.substring(0, 24)}`,
      });
      setFeedbackDrafts((prev) => ({
        ...prev,
        [poster.id]: { ...prev[poster.id], text: "" },
      }));
      setStep(4);
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
          copyLayoutMode: CopyLayoutMode;
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
        copyLayoutMode,
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
      assignOverlaysToPosters(generated);
      setGenerationSnapshot(buildGenerationSnapshot("ideas"));
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
      setGenerationSnapshot({
        mode: "optimize-poster",
        summary: `${ART_STYLES.find((style) => style.id === selectedStyle)?.label || selectedStyle} · ${selectedRatio} · 反馈重点 ${feedbackFocuses.join("、") || "自然语言"}`,
      });
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

      {editingPoster ? (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl">
          <div className="glass-panel grid max-h-[92vh] w-full max-w-6xl gap-4 overflow-hidden rounded-[32px] p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-0 overflow-auto rounded-[24px] bg-[var(--surface-muted)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">文案排版编辑器</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">支持拖拽位置与缩放大小，先完成最常用的基础排版调整。</p>
                </div>
                <button
                  onClick={() => {
                    setEditingPosterId(null);
                    setSelectedOverlayId(null);
                  }}
                  className="rounded-full bg-[var(--surface-elevated)] p-2 text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div data-overlay-stage>
                <PosterComposite
                  posterUrl={editingPoster.url}
                  overlays={editingOverlays}
                  selectedOverlayId={selectedOverlayId}
                  editable
                  onSelectOverlay={setSelectedOverlayId}
                  onOverlayPointerDown={(event, overlayId) => handleOverlayPointerDown(event, editingPoster.id, overlayId)}
                />
              </div>
            </div>
            <div className="min-h-0 overflow-auto rounded-[24px] bg-[var(--surface-muted)] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">排版控件</p>
              {selectedOverlay ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">当前元素</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedOverlay.type}</p>
                  </div>
                  {selectedOverlay.text !== undefined ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">文案内容</span>
                      <textarea
                        value={selectedOverlay.text}
                        onChange={(e) => updateSelectedOverlay({ text: e.target.value })}
                        className="soft-input h-28 w-full rounded-[18px] px-4 py-3 text-sm resize-none"
                      />
                    </label>
                  ) : null}
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                      {selectedOverlay.text !== undefined ? "字体大小" : "元素宽度"}
                    </span>
                    <input
                      type="range"
                      min={selectedOverlay.text !== undefined ? 12 : 8}
                      max={selectedOverlay.text !== undefined ? 96 : 28}
                      value={selectedOverlay.text !== undefined ? selectedOverlay.fontSize || 18 : selectedOverlay.width}
                      onChange={(e) =>
                        updateSelectedOverlay(
                          selectedOverlay.text !== undefined
                            ? { fontSize: Number(e.target.value) }
                            : { width: Number(e.target.value) },
                        )
                      }
                      className="w-full"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">X</span>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={selectedOverlay.x}
                        onChange={(e) => updateSelectedOverlay({ x: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Y</span>
                      <input
                        type="range"
                        min={0}
                        max={95}
                        value={selectedOverlay.y}
                        onChange={(e) => updateSelectedOverlay({ y: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border border-dashed border-[var(--border-subtle)] px-4 py-10 text-sm text-[var(--text-secondary)]">
                  点选海报上的文字、二维码或 logo，就可以开始拖拽和缩放。
                </div>
              )}
            </div>
          </div>
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
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <WorkbenchCard title="第一步 · 输入" subtitle="上传产品与风格参考，输入文字需求，再一次性决定尺寸、风格、数量和有无文案。">
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">产品图（可选，单张）</label>
                        <button
                          onClick={() => productInputRef.current?.click()}
                          className="flex w-full items-center gap-4 rounded-[24px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4 text-left transition hover:bg-[var(--surface-strong)]"
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={productInputRef}
                            onChange={(e) => handleSingleAssetUpload(e, setProductImage, "product")}
                          />
                          {productImage ? (
                            <>
                              <img src={productImage.url} className="h-20 w-20 rounded-[18px] object-cover" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{productImage.name}</div>
                                <div className="mt-1 text-xs text-[var(--text-secondary)]">已作为主体参考图</div>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setProductImage(null);
                                }}
                                className="rounded-full bg-black/70 p-1.5 text-white"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--surface-strong)] text-[var(--text-secondary)]">
                                <ImageIcon size={18} />
                              </div>
                              <div>
                                <div className="text-sm font-semibold">上传产品图</div>
                                <div className="mt-1 text-xs text-[var(--text-secondary)]">自动压缩，减少 413 风险</div>
                              </div>
                            </>
                          )}
                        </button>
                      </div>

                      <div>
                        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                          风格参考（可选，最多 {MAX_STYLE_REFERENCE_COUNT} 张）
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
                            onChange={(e) => handleMultiAssetUpload(e, setStyleRefImages, "style")}
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
                                    className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white"
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
                                <div className="text-sm font-semibold">上传风格参考</div>
                                <div className="mt-1 text-xs text-[var(--text-secondary)]">最多 4 张，会自动压缩</div>
                              </div>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">文字需求</label>
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
                        placeholder="例如：新品发布海报，突出产品主体和高级感，适合小红书与官网首屏..."
                        className="soft-input h-36 w-full rounded-[24px] px-5 py-4 text-sm resize-none"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">输出尺寸</label>
                        <div className="grid grid-cols-2 gap-2">
                          {ASPECT_RATIOS.map((ratio) => (
                            <button
                              key={ratio.id}
                              onClick={() => setSelectedRatio(ratio.id)}
                              className={`rounded-[18px] px-3 py-3 text-sm font-medium transition ${
                                selectedRatio === ratio.id
                                  ? "bg-[var(--accent-strong)] text-white"
                                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                              }`}
                            >
                              {ratio.id}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">海报风格</label>
                        <div className="grid grid-cols-2 gap-2">
                          {ART_STYLES.slice(0, 8).map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setSelectedStyle(style.id)}
                              className={`rounded-[18px] px-3 py-3 text-sm font-medium transition ${
                                selectedStyle === style.id
                                  ? "bg-[var(--accent-strong)] text-white"
                                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                              }`}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">生成数量</label>
                        <div className="flex gap-2">
                          {IMAGE_COUNT_OPTIONS.map((count) => (
                            <button
                              key={count}
                              onClick={() => setImageCount(count)}
                              className={`flex-1 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
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

                      <div>
                        <label className="mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">文案模式</label>
                        <div className="grid gap-2">
                          {COPY_LAYOUT_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setCopyLayoutMode(option.id)}
                              className={`rounded-[18px] px-3 py-3 text-left text-sm font-medium transition ${
                                copyLayoutMode === option.id
                                  ? "bg-[var(--accent-strong)] text-white"
                                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {copyLayoutMode === "with-copy" ? (
                      <div className="space-y-4 rounded-[24px] bg-[var(--surface-muted)] p-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">主标题</span>
                          <input
                            value={copyFields.headline}
                            onChange={(e) => setCopyFields((prev) => ({ ...prev, headline: e.target.value }))}
                            className="soft-input w-full rounded-[18px] px-4 py-3 text-sm"
                            placeholder="输入主标题"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">副标题</span>
                          <input
                            value={copyFields.subheadline}
                            onChange={(e) => setCopyFields((prev) => ({ ...prev, subheadline: e.target.value }))}
                            className="soft-input w-full rounded-[18px] px-4 py-3 text-sm"
                            placeholder="输入副标题"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">正文</span>
                          <textarea
                            value={copyFields.body}
                            onChange={(e) => setCopyFields((prev) => ({ ...prev, body: e.target.value }))}
                            className="soft-input h-24 w-full rounded-[18px] px-4 py-3 text-sm resize-none"
                            placeholder="输入正文"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">备注</span>
                          <input
                            value={copyFields.note}
                            onChange={(e) => setCopyFields((prev) => ({ ...prev, note: e.target.value }))}
                            className="soft-input w-full rounded-[18px] px-4 py-3 text-sm"
                            placeholder="输入备注"
                          />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            onClick={() => qrInputRef.current?.click()}
                            className="rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-4 text-left transition hover:bg-[var(--surface-strong)]"
                          >
                            <input type="file" accept="image/*" ref={qrInputRef} className="hidden" onChange={(e) => handleSingleAssetUpload(e, setQrAsset, "qr")} />
                            <div className="text-sm font-semibold text-[var(--text-primary)]">二维码区</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">{qrAsset ? qrAsset.name : "上传二维码"}</div>
                          </button>
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            className="rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-4 text-left transition hover:bg-[var(--surface-strong)]"
                          >
                            <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={(e) => handleSingleAssetUpload(e, setLogoAsset, "logo")} />
                            <div className="text-sm font-semibold text-[var(--text-primary)]">Logo 区</div>
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">{logoAsset ? logoAsset.name : "上传 logo"}</div>
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)]">生成后可继续拖拽、缩放和编辑这些文案与图片元素。</p>
                      </div>
                    ) : null}

                    <button
                      onClick={directGeneratePosters}
                      className="w-full rounded-full bg-[var(--accent-strong)] px-5 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition hover:opacity-90"
                    >
                      生成初稿 × {imageCount}
                    </button>
                  </div>
                </WorkbenchCard>

                <WorkbenchCard title="当前设置" subtitle="旧的创意方向中间层已退到次要逻辑，主流程只保留输入、初稿、逐稿反馈和重新生成。">
                  <div className="space-y-3">
                    {[
                      { label: "产品图", value: productImage ? "已上传" : "未上传" },
                      { label: "风格参考", value: `${styleRefImages.length} 张` },
                      { label: "文字需求", value: prompt.trim() ? "已填写" : "未填写" },
                      { label: "输出尺寸", value: selectedRatio },
                      { label: "海报风格", value: ART_STYLES.find((style) => style.id === selectedStyle)?.label || "未设置" },
                      { label: "生成数量", value: `${imageCount} 张` },
                      { label: "文案模式", value: copyLayoutMode === "with-copy" ? "有文案" : "无文案" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-[18px] bg-[var(--surface-muted)] px-4 py-3">
                        <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
                      </div>
                    ))}
                    <div className="rounded-[18px] bg-[var(--surface-muted)] px-4 py-4 text-xs leading-5 text-[var(--text-secondary)]">
                      上传内容会先在浏览器内压缩，再进入生成请求；如果仍超限，会在发送前直接提示你。
                    </div>
                  </div>
                </WorkbenchCard>
              </div>
            ) : null}

            {step === 2 ? (
              <WorkbenchCard title="第二步 · 初稿" subtitle="根据当前需求直接生成 1 到 3 张初稿。先看画面方向，再进入逐张反馈。">
                {!initialPosters.length ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                    先在第一步输入需求并生成初稿。
                  </div>
                ) : (
                  <div className="space-y-5">
                    {generationSnapshot ? (
                      <div className="rounded-[24px] bg-[var(--surface-muted)] px-5 py-4 text-sm text-[var(--text-secondary)]">
                        本轮生成摘要：{generationSnapshot.summary}
                      </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {initialPosters.map((poster, index) => (
                        <div key={poster.id} className="surface-card overflow-hidden rounded-[24px] border border-[var(--border-subtle)]">
                          <button className="block w-full overflow-hidden" onClick={() => setPreviewImg(poster.url)}>
                            {posterOverlays[poster.id]?.length ? (
                              <PosterComposite posterUrl={poster.url} overlays={posterOverlays[poster.id]} />
                            ) : (
                              <img src={poster.url} className="aspect-[4/5] w-full object-cover transition duration-500 hover:scale-[1.02]" />
                            )}
                          </button>
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[var(--text-primary)]">初稿 {index + 1}</div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{poster.ideaText}</p>
                              </div>
                              <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                                {selectedRatio}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  setActivePoster(poster);
                                  setStep(3);
                                }}
                                className="rounded-full bg-[var(--accent-strong)] px-3 py-2.5 text-sm font-semibold text-white"
                              >
                                去修改
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await downloadPosterAsset(
                                      poster.url,
                                      `${buildFileBaseName()}-draft-${index + 1}.png`,
                                      posterOverlays[poster.id] || [],
                                    );
                                  } catch (err: any) {
                                    setNotice({ tone: "error", message: err.message || "下载失败，请重试" });
                                  }
                                }}
                                className="rounded-full bg-[var(--surface-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
                              >
                                下载
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
                              {copyLayoutMode === "with-copy" && posterOverlays[poster.id]?.length ? (
                                <button
                                  onClick={() => openOverlayEditor(poster)}
                                  className="flex-1 rounded-full bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                >
                                  编辑文案
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setStep(3)}
                        className="rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white"
                      >
                        进入逐张反馈
                      </button>
                      <button
                        onClick={() => setStep(1)}
                        className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)]"
                      >
                        返回调整输入
                      </button>
                    </div>
                  </div>
                )}
              </WorkbenchCard>
            ) : null}

            {step === 3 ? (
              <WorkbenchCard title="第三步 · 逐张反馈" subtitle="每张初稿下直接填写修改需求，并决定这张图要再生成 1 到 3 个版本。">
                {!initialPosters.length ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                    先完成初稿生成，再逐张填写修改需求。
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-[24px] bg-[var(--surface-muted)] px-5 py-4 text-sm text-[var(--text-secondary)]">
                      修改说明支持自然语言，也可以结合风格参考用 <span className="font-semibold text-[var(--text-primary)]">@图1</span>、<span className="font-semibold text-[var(--text-primary)]">@图2</span> 做更精细的操作。
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {initialPosters.map((poster, index) => {
                        const draft = feedbackDrafts[poster.id] || { text: "", count: 1 as const };
                        const active = activePoster?.id === poster.id;
                        return (
                          <div
                            key={poster.id}
                            className={`surface-card rounded-[26px] border p-4 transition ${
                              active ? "border-[var(--accent-strong)] shadow-[var(--shadow-card)]" : "border-[var(--border-subtle)]"
                            }`}
                          >
                            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                              <div className="space-y-3">
                                <button className="block w-full overflow-hidden rounded-[20px]" onClick={() => setPreviewImg(poster.url)}>
                                  {posterOverlays[poster.id]?.length ? (
                                    <PosterComposite posterUrl={poster.url} overlays={posterOverlays[poster.id]} />
                                  ) : (
                                    <img src={poster.url} className="aspect-[4/5] w-full object-cover" />
                                  )}
                                </button>
                                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                  <span className="font-semibold text-[var(--text-primary)]">初稿 {index + 1}</span>
                                  <span>{selectedRatio}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setPreviewImg(poster.url)}
                                    className="flex-1 rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                  >
                                    预览
                                  </button>
                                  {copyLayoutMode === "with-copy" && posterOverlays[poster.id]?.length ? (
                                    <button
                                      onClick={() => openOverlayEditor(poster)}
                                      className="flex-1 rounded-full bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                    >
                                      文案
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h3 className="text-base font-semibold text-[var(--text-primary)]">基于这张初稿继续细化</h3>
                                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                      {poster.ideaText || "保持主体方向，按反馈重新生成。"}
                                    </p>
                                  </div>
                                  {refinedGroups.some((group) => group.sourcePoster.id === poster.id) ? (
                                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]">
                                      已有修改稿
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {QUICK_FEEDBACK_CHIPS.map((chip) => (
                                    <button
                                      key={`${poster.id}-${chip}`}
                                      onClick={() =>
                                        updateFeedbackDraft(poster.id, {
                                          text: draft.text.trim()
                                            ? `${draft.text}${draft.text.endsWith(" ") ? "" : "，"}${chip}`
                                            : chip,
                                        })
                                      }
                                      className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
                                    >
                                      {chip}
                                    </button>
                                  ))}
                                  {styleRefImages.map((_, refIndex) => (
                                    <button
                                      key={`${poster.id}-ref-${refIndex}`}
                                      onClick={() =>
                                        updateFeedbackDraft(poster.id, {
                                          text: `${draft.text}${draft.text ? " " : ""}@图${refIndex + 1} `,
                                        })
                                      }
                                      className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]"
                                    >
                                      @图{refIndex + 1}
                                    </button>
                                  ))}
                                </div>

                                <textarea
                                  value={draft.text}
                                  onChange={(e) => updateFeedbackDraft(poster.id, { text: e.target.value })}
                                  placeholder="例如：主体更突出，背景更干净，颜色更统一，把 @图1 的产品放进当前构图里..."
                                  className="soft-input h-36 w-full rounded-[24px] px-5 py-4 text-sm resize-none"
                                />

                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">重新生成数量</div>
                                    <div className="flex gap-2">
                                      {IMAGE_COUNT_OPTIONS.map((count) => (
                                        <button
                                          key={`${poster.id}-${count}`}
                                          onClick={() => updateFeedbackDraft(poster.id, { count })}
                                          className={`rounded-[16px] px-4 py-2 text-sm font-medium transition ${
                                            draft.count === count
                                              ? "bg-[var(--accent-strong)] text-white"
                                              : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)]"
                                          }`}
                                        >
                                          {count}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setActivePoster(poster);
                                      regeneratePoster(poster);
                                    }}
                                    disabled={!draft.text.trim()}
                                    className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                                      draft.text.trim()
                                        ? "bg-[var(--accent-strong)] text-white shadow-[var(--shadow-card)]"
                                        : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                                    }`}
                                  >
                                    重新生成 × {draft.count}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </WorkbenchCard>
            ) : null}

            {step === 4 ? (
              <WorkbenchCard title="第四步 · 重新生成" subtitle="每次修改都会挂在对应初稿下面，方便你快速回看这张图是从哪一版迭代出来的。">
                {!refinedGroups.length ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center text-[var(--text-secondary)]">
                    先在第三步对某张初稿填写反馈并重新生成。
                  </div>
                ) : (
                  <div className="space-y-6">
                    {generationSnapshot ? (
                      <div className="rounded-[24px] bg-[var(--surface-muted)] px-5 py-4 text-sm text-[var(--text-secondary)]">
                        最近一次修改摘要：{generationSnapshot.summary}
                      </div>
                    ) : null}
                    {refinedGroups.map((group, groupIndex) => (
                      <div
                        key={group.sourcePoster.id}
                        className={`rounded-[28px] border p-4 md:p-5 ${
                          latestRefinedSourceId === group.sourcePoster.id
                            ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]/30"
                            : "border-[var(--border-subtle)] bg-[var(--surface-muted)]"
                        }`}
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-tertiary)]">来源初稿 {groupIndex + 1}</div>
                            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{group.sourcePoster.ideaText}</h3>
                          </div>
                          <div className="flex gap-2">
                            {latestRefinedSourceId === group.sourcePoster.id ? (
                              <span className="rounded-full bg-[var(--accent-strong)] px-3 py-1.5 text-xs font-medium text-white">最新一组</span>
                            ) : null}
                            <button
                              onClick={() => {
                                setActivePoster(group.sourcePoster);
                                setStep(3);
                              }}
                              className="rounded-full bg-[var(--surface-elevated)] px-4 py-2 text-xs font-medium text-[var(--text-primary)]"
                            >
                              再改这张
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <div className="space-y-3">
                            <button className="block w-full overflow-hidden rounded-[20px]" onClick={() => setPreviewImg(group.sourcePoster.url)}>
                              {posterOverlays[group.sourcePoster.id]?.length ? (
                                <PosterComposite posterUrl={group.sourcePoster.url} overlays={posterOverlays[group.sourcePoster.id]} />
                              ) : (
                                <img src={group.sourcePoster.url} className="aspect-[4/5] w-full object-cover" />
                              )}
                            </button>
                            <div className="rounded-[18px] bg-[var(--surface-elevated)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                              这张是原始初稿，右侧是根据该初稿反馈重新生成的版本。
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {group.results.map((poster, index) => (
                              <div key={poster.id} className="surface-card overflow-hidden rounded-[24px] border border-[var(--border-subtle)]">
                                <button className="block w-full overflow-hidden" onClick={() => setPreviewImg(poster.url)}>
                                  {posterOverlays[poster.id]?.length ? (
                                    <PosterComposite posterUrl={poster.url} overlays={posterOverlays[poster.id]} />
                                  ) : (
                                    <img src={poster.url} className="aspect-[4/5] w-full object-cover transition duration-500 hover:scale-[1.02]" />
                                  )}
                                </button>
                                <div className="space-y-3 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-[var(--text-primary)]">修改稿 {index + 1}</div>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{poster.ideaText}</p>
                                    </div>
                                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                                      {poster.sourceLabel || "修改生成"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => {
                                        setActivePoster(group.sourcePoster);
                                        setStep(3);
                                      }}
                                      className="rounded-full bg-[var(--surface-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
                                    >
                                      再修改
                                    </button>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await downloadPosterAsset(
                                            poster.url,
                                            `${buildFileBaseName()}-refined-${index + 1}.png`,
                                            posterOverlays[poster.id] || [],
                                          );
                                        } catch (err: any) {
                                          setNotice({ tone: "error", message: err.message || "下载失败，请重试" });
                                        }
                                      }}
                                      className="rounded-full bg-[var(--accent-strong)] px-3 py-2.5 text-sm font-semibold text-white"
                                    >
                                      下载
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setPreviewImg(poster.url)}
                                      className="flex-1 rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                    >
                                      预览
                                    </button>
                                    {copyLayoutMode === "with-copy" && posterOverlays[poster.id]?.length ? (
                                      <button
                                        onClick={() => openOverlayEditor(poster)}
                                        className="flex-1 rounded-full bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                                      >
                                        编辑文案
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </WorkbenchCard>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
