import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Download, CheckCircle2, RefreshCw, ChevronRight, MessageSquare,
  ArrowLeft, Sparkles, Plus, Edit3, Image as ImageIcon, Trash2, X, Eye,
  Layers, Settings, FolderOpen, FileText, Copy, ZoomIn, Grid, Star,
  Camera, Palette, Box, Shapes, Minimize2, Mountain, Package, Film, Wand2,
  Monitor, ChevronDown, Check, Send, Paperclip, AtSign
} from "lucide-react";

/* ═══════════════════════════════════════════
   核心配置
   ═══════════════════════════════════════════ */
const API_CONFIG = {
  key: "",
  baseUrl: "https://openai.1pix.fun/v1/chat/completions"
};

const TEXT_MODEL = "deepseek-v3.2-exp";

const IMAGE_MODELS = [
  { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash", tag: "快速" },
  { id: "gemini-3-pro-image-preview", label: "Gemini 3 Pro", tag: "高质量" },
  { id: "mj_imagine", label: "Midjourney Imagine", tag: "创意" },
  { id: "mj_blend", label: "Midjourney Blend", tag: "融合" },
  { id: "mj_describe", label: "Midjourney Describe", tag: "描述" },
  { id: "flux-pro", label: "Flux Pro", tag: "稳定" },
  { id: "flux-1.1-pro", label: "Flux 1.1 Pro", tag: "精细" },
];

const ART_STYLES = [
  { id: "photography", label: "摄影海报", icon: Camera, desc: "真实摄影质感，光影氛围强烈" },
  { id: "handdrawn", label: "手绘海报", icon: Edit3, desc: "手绘质感，温暖有灵魂" },
  { id: "3d", label: "三维海报", icon: Box, desc: "3D渲染，空间感十足" },
  { id: "abstract", label: "抽象风格", icon: Shapes, desc: "抽象视觉，前卫艺术感" },
  { id: "flat", label: "扁平风格", icon: Minimize2, desc: "扁平设计，简洁明快" },
  { id: "miniature", label: "微缩景观", icon: Mountain, desc: "微缩模型，精致趣味" },
  { id: "product", label: "产品海报", icon: Package, desc: "产品展示，商业质感" },
  { id: "anime", label: "动漫海报", icon: Film, desc: "动漫画风，二次元美学" },
  { id: "smart", label: "智能模式", icon: Wand2, desc: "根据参考图自动匹配风格" },
];

const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16", w: 9, h: 16, desc: "竖版" },
  { id: "3:4", label: "3:4", w: 3, h: 4, desc: "竖版" },
  { id: "1:1", label: "1:1", w: 1, h: 1, desc: "方形" },
  { id: "4:3", label: "4:3", w: 4, h: 3, desc: "横版" },
  { id: "16:9", label: "16:9", w: 16, h: 9, desc: "横版" },
];

const STYLE_PROMPTS = {
  photography: "Cinematic photography poster, professional studio lighting, high-resolution, photorealistic, dramatic composition, commercial quality",
  handdrawn: "Hand-drawn illustration poster, watercolor and ink textures, artistic brushstrokes, warm organic feel, hand-crafted aesthetic",
  "3d": "3D rendered poster, Cinema 4D style, volumetric lighting, glossy materials, depth of field, modern 3D design",
  abstract: "Abstract art poster, bold geometric forms, avant-garde composition, vibrant color blocks, contemporary art style",
  flat: "Flat design poster, clean vector graphics, minimal shadows, bold solid colors, modern flat illustration style",
  miniature: "Miniature tilt-shift diorama poster, tiny detailed world, selective focus, toy-like proportions, warm lighting",
  product: "Product showcase poster, commercial photography, clean background, professional product placement, premium commercial quality",
  anime: "Anime style poster, Japanese animation aesthetic, vivid colors, dynamic composition, manga-inspired illustration",
  smart: ""
};

/* ═══════════════════════════════════════════
   API 工具
   ═══════════════════════════════════════════ */
async function callAPI(messages, model, customConfig = {}) {
  const response = await fetch(API_CONFIG.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_CONFIG.key}`
    },
    body: JSON.stringify({ model, messages, ...customConfig })
  });
  if (!response.ok) {
    let msg = "请求失败";
    try { const d = await response.json(); if (d.error?.message) msg = d.error.message; } catch {}
    throw new Error(msg);
  }
  return response.json();
}

function extractImageData(content) {
  if (!content) throw new Error("API 返回空内容");
  const md = content.match(/!\[.*?\]\((.*?)\)/);
  if (md?.[1]) return md[1];
  const http = content.match(/(https?:\/\/[^\s)"']+)/);
  if (http?.[1]) return http[1];
  if (content.includes("data:image")) {
    const b64 = content.match(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/);
    if (b64) return b64[0];
  }
  const t = content.trim();
  if (t.length > 500 && !t.includes(" ")) return `data:image/png;base64,${t}`;
  throw new Error(`未返回有效图片: "${content.substring(0, 80)}..."`);
}

/* ═══════════════════════════════════════════
   主应用
   ═══════════════════════════════════════════ */
export default function App() {
  // --- 全局状态 ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("poster_api_key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");

  // --- 模型 & 风格选择 ---
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id);
  const [selectedStyle, setSelectedStyle] = useState("photography");
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [showModelPicker, setShowModelPicker] = useState(false);

  // --- Step 1: 需求输入 ---
  const [prompt, setPrompt] = useState("");
  const [styleRefImg, setStyleRefImg] = useState(null); // {mimeType, data, url}
  const styleRefInputRef = useRef(null);

  // --- Step 1 右侧：上传现有海报优化 ---
  const [uploadedPoster, setUploadedPoster] = useState(null);
  const [optimizeFeedback, setOptimizeFeedback] = useState("");
  const uploadPosterRef = useRef(null);

  // --- Step 2: 创意提示词 ---
  const [ideas, setIdeas] = useState([]);
  const [selectedIdeas, setSelectedIdeas] = useState([]);

  // --- Step 3: 生成的海报 ---
  const [posters, setPosters] = useState([]); // [{id, url, ideaText, timestamp}]

  // --- Step 4: 反馈优化 ---
  const [feedbackText, setFeedbackText] = useState("");
  const [refImages, setRefImages] = useState([]); // [{id, mimeType, data, url, name}]
  const refImgInputRef = useRef(null);
  const [activePoster, setActivePoster] = useState(null); // poster being optimized

  // --- Step 5: 提案 ---
  const [proposalText, setProposalText] = useState("");
  const [finalPoster, setFinalPoster] = useState(null);

  // --- 存储区 ---
  const [storage, setStorage] = useState(() => {
    try { return JSON.parse(localStorage.getItem("poster_storage") || "[]"); } catch { return []; }
  });
  const [showStorage, setShowStorage] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  // persist
  useEffect(() => { localStorage.setItem("poster_storage", JSON.stringify(storage)); }, [storage]);
  useEffect(() => { localStorage.setItem("poster_api_key", apiKey); API_CONFIG.key = apiKey; }, [apiKey]);
  useEffect(() => { API_CONFIG.key = apiKey; }, []);

  // --- 自动存储生成的海报 ---
  const addToStorage = useCallback((url, label = "海报") => {
    const item = { id: Date.now().toString() + Math.random().toString(36).slice(2), url, label, timestamp: Date.now() };
    setStorage(prev => [item, ...prev]);
    return item;
  }, []);

  // --- 图片上传通用 ---
  const handleFileUpload = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(",")[1];
      setter({ mimeType: file.type, data: b64, url: reader.result, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleMultiFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result.split(",")[1];
        setRefImages(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          mimeType: file.type, data: b64, url: reader.result, name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const downloadImage = (url, filename) => {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  /* ═══════════════════════════════════════════
     Step 1 → 2: 生成6个创意提示词
     ═══════════════════════════════════════════ */
  const generateIdeas = async () => {
    if (!prompt.trim() && !styleRefImg) { setError("请输入文字需求或上传参考风格图"); return; }
    if (!apiKey) { setError("请先在设置中填入 API Key"); setShowSettings(true); return; }
    setLoading(true); setError("");
    setLoadingText("AI 正在构思 6 个创意方向...");
    try {
      const styleName = ART_STYLES.find(s => s.id === selectedStyle)?.label || "";
      const ratioLabel = selectedRatio;
      const content = [];
      content.push({
        type: "text",
        text: `你是一位顶尖海报设计创意总监。基于以下需求，生成6个完全不同的创意提示词（英文prompt），每个prompt要详细描述海报的视觉内容、构图、氛围和细节。
需求: "${prompt}"
美术风格: ${styleName}
画幅比例: ${ratioLabel}
${selectedStyle === "smart" && styleRefImg ? "请根据上传的参考图风格来决定美术方向。" : ""}
严格返回JSON: {"ideas": ["prompt1", "prompt2", "prompt3", "prompt4", "prompt5", "prompt6"]}`
      });
      if (styleRefImg) {
        content.push({ type: "image_url", image_url: { url: `data:${styleRefImg.mimeType};base64,${styleRefImg.data}` } });
      }
      const res = await callAPI([{ role: "user", content }], TEXT_MODEL, { response_format: { type: "json_object" } });
      const parsed = JSON.parse(res.choices?.[0]?.message?.content || "{}");
      let arr = parsed.ideas || Object.values(parsed).find(Array.isArray) || [];
      if (arr.length < 6) arr = [...arr, ...Array(6 - arr.length).fill("Creative poster design concept")];
      setIdeas(arr.slice(0, 6));
      setSelectedIdeas([]);
      setStep(2);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /* Step 1 右侧：上传海报直接优化出3图 */
  const optimizeExisting = async () => {
    if (!uploadedPoster) { setError("请上传需要优化的海报"); return; }
    if (!apiKey) { setError("请先填入 API Key"); setShowSettings(true); return; }
    setLoading(true); setError("");
    setLoadingText("正在根据反馈优化海报，生成 3 个版本...");
    try {
      const stylePrompt = STYLE_PROMPTS[selectedStyle] || "";
      const results = await Promise.all([1, 2, 3].map(async (v) => {
        const p = `Redesign and optimize this poster. ${stylePrompt} Aspect ratio: ${selectedRatio}. ${optimizeFeedback || "Make it more professional and visually striking."} Variation ${v}.`;
        const r = await callAPI([{
          role: "user",
          content: [
            { type: "text", text: p },
            { type: "image_url", image_url: { url: `data:${uploadedPoster.mimeType};base64,${uploadedPoster.data}` } }
          ]
        }], selectedModel);
        return extractImageData(r.choices?.[0]?.message?.content);
      }));
      const newPosters = results.filter(Boolean).map((url, i) => {
        const item = addToStorage(url, `优化版本${i + 1}`);
        return { id: item.id, url, ideaText: `基于原图优化 v${i + 1}`, timestamp: Date.now() };
      });
      setPosters(prev => [...newPosters, ...prev]);
      setStep(3);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /* ═══════════════════════════════════════════
     Step 2 → 3: 根据选中创意出图
     ═══════════════════════════════════════════ */
  const generatePosters = async () => {
    if (selectedIdeas.length === 0) { setError("请至少选择一个创意"); return; }
    setLoading(true); setError("");
    setLoadingText(`正在生成 ${selectedIdeas.length * 3} 张海报...`);
    try {
      const stylePrompt = STYLE_PROMPTS[selectedStyle] || "";
      const allResults = [];
      for (const ideaIdx of selectedIdeas) {
        const ideaText = ideas[ideaIdx];
        const variants = await Promise.all([1, 2, 3].map(async (v) => {
          const p = `${ideaText}. ${stylePrompt} Aspect ratio: ${selectedRatio}. High quality poster design. Variation ${v}.`;
          const r = await callAPI([{ role: "user", content: p }], selectedModel);
          return extractImageData(r.choices?.[0]?.message?.content);
        }));
        variants.filter(Boolean).forEach((url, i) => {
          const item = addToStorage(url, `创意${ideaIdx + 1}-v${i + 1}`);
          allResults.push({ id: item.id, url, ideaText: ideaText.substring(0, 60), timestamp: Date.now() });
        });
      }
      setPosters(prev => [...allResults, ...prev]);
      setStep(3);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /* ═══════════════════════════════════════════
     Step 4: 反馈优化（支持@引用参考图）
     ═══════════════════════════════════════════ */
  const optimizePoster = async () => {
    if (!activePoster) { setError("请先选择要优化的海报"); return; }
    if (!feedbackText.trim()) { setError("请输入反馈意见"); return; }
    setLoading(true); setError("");
    setLoadingText("根据反馈优化中...");
    try {
      const stylePrompt = STYLE_PROMPTS[selectedStyle] || "";
      // 解析@引用
      let feedbackProcessed = feedbackText;
      const mentionedImgs = [];
      const mentionRegex = /@图\s*(\d+)/g;
      let match;
      while ((match = mentionRegex.exec(feedbackText)) !== null) {
        const idx = parseInt(match[1]) - 1;
        if (refImages[idx]) mentionedImgs.push(refImages[idx]);
      }

      const content = [];
      content.push({
        type: "text",
        text: `Optimize this poster based on feedback: "${feedbackProcessed}". ${stylePrompt} Aspect ratio: ${selectedRatio}. Keep the core composition but apply the requested changes.`
      });
      content.push({ type: "image_url", image_url: { url: activePoster.url } });
      mentionedImgs.forEach(img => {
        content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
      });

      const results = await Promise.all([1, 2, 3].map(async (v) => {
        const r = await callAPI([{ role: "user", content: [...content, { type: "text", text: `Variation ${v}` }] }], selectedModel);
        return extractImageData(r.choices?.[0]?.message?.content);
      }));

      const newPosters = results.filter(Boolean).map((url, i) => {
        const item = addToStorage(url, `优化版${i + 1}`);
        return { id: item.id, url, ideaText: `优化: ${feedbackText.substring(0, 40)}`, timestamp: Date.now() };
      });
      setPosters(prev => [...newPosters, ...prev]);
      setFeedbackText("");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /* ═══════════════════════════════════════════
     Step 5: 生成提案说明
     ═══════════════════════════════════════════ */
  const generateProposal = async () => {
    if (!finalPoster) { setError("请先选择定稿海报"); return; }
    setLoading(true); setError("");
    setLoadingText("正在撰写提案说明...");
    try {
      const r = await callAPI([{
        role: "user",
        content: [
          { type: "text", text: `你是资深品牌策划师。请为这张海报撰写一份专业提案说明，包含：
1. 设计理念与灵感来源
2. 视觉元素分析（构图、色彩、字体、层次）
3. 目标受众与传播策略
4. 应用场景建议
5. 后续优化方向
请用中文撰写，格式清晰，有深度和创意洞察。` },
          { type: "image_url", image_url: { url: finalPoster.url } }
        ]
      }], TEXT_MODEL);
      setProposalText(r.choices?.[0]?.message?.content || "提案生成失败");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /* ═══════════════════════════════════════════
     渲染
     ═══════════════════════════════════════════ */

  const currentRatio = ASPECT_RATIOS.find(r => r.id === selectedRatio);

  return (
    <div style={{ fontFamily: "'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif" }}
      className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-500/30">

      {/* ═══ Loading Overlay ═══ */}
      {loading && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-amber-500 animate-pulse" />
          </div>
          <p className="mt-6 text-lg font-medium text-neutral-300 animate-pulse">{loadingText}</p>
        </div>
      )}

      {/* ═══ Image Preview Modal ═══ */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/95 z-[90] flex items-center justify-center p-8"
          onClick={() => setPreviewImg(null)}>
          <button className="absolute top-6 right-6 text-white/60 hover:text-white" onClick={() => setPreviewImg(null)}>
            <X size={28} />
          </button>
          <img src={previewImg} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/60">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setStep(1); setShowStorage(false); }}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-semibold tracking-tight text-white">AI 海报工坊</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <div className="relative">
              <button onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/50 text-xs font-medium text-neutral-300 hover:bg-neutral-700/80 transition-all">
                <Monitor size={14} />
                {IMAGE_MODELS.find(m => m.id === selectedModel)?.label}
                <ChevronDown size={12} />
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-neutral-900 border border-neutral-700/60 rounded-xl shadow-2xl p-2 z-50">
                  {IMAGE_MODELS.map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                        selectedModel === m.id ? "bg-amber-500/15 text-amber-400" : "text-neutral-300 hover:bg-neutral-800"
                      }`}>
                      <span>{m.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedModel === m.id ? "bg-amber-500/20 text-amber-400" : "bg-neutral-800 text-neutral-500"
                      }`}>{m.tag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowStorage(!showStorage)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showStorage ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-neutral-800/80 border border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/80"
              }`}>
              <FolderOpen size={14} />
              存储区 ({storage.length})
            </button>
            <button onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-neutral-800/80 border border-neutral-700/50 text-neutral-400 hover:text-white transition-all">
              <Settings size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Settings Modal ═══ */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-neutral-900 border border-neutral-700/60 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">设置</h3>
            <label className="block text-sm text-neutral-400 mb-2">API Key (1pix.fun)</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
            <button onClick={() => setShowSettings(false)}
              className="mt-4 w-full py-2.5 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-all">
              保存
            </button>
          </div>
        </div>
      )}

      {/* ═══ Error Toast ═══ */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] bg-red-500/15 border border-red-500/30 text-red-400 px-5 py-3 rounded-xl flex items-center gap-3 max-w-lg backdrop-blur-xl">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-6 py-6">

        {/* ═══════════════════════════════════════════
            存储区（文件管理）
            ═══════════════════════════════════════════ */}
        {showStorage ? (
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">存储区</h2>
              <div className="flex gap-2">
                {storage.length > 0 && (
                  <button onClick={() => { if(confirm("确认清空所有存储？")) setStorage([]); }}
                    className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all">
                    清空全部
                  </button>
                )}
                <button onClick={() => setShowStorage(false)}
                  className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-700 rounded-lg hover:bg-neutral-800 transition-all">
                  返回工作区
                </button>
              </div>
            </div>
            {storage.length === 0 ? (
              <div className="text-center py-24 text-neutral-500">
                <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p>暂无存储的海报</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {storage.map(item => (
                  <div key={item.id} className="group relative bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:border-neutral-600 transition-all">
                    <div className="aspect-square relative overflow-hidden cursor-pointer" onClick={() => setPreviewImg(item.url)}>
                      <img src={item.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-neutral-400 truncate">{item.label}</p>
                      <p className="text-[10px] text-neutral-600 mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => downloadImage(item.url, `${item.label}.png`)}
                        className="p-1.5 bg-black/60 backdrop-blur rounded-lg text-white hover:bg-amber-500 transition-all">
                        <Download size={12} />
                      </button>
                      <button onClick={() => setStorage(prev => prev.filter(s => s.id !== item.id))}
                        className="p-1.5 bg-black/60 backdrop-blur rounded-lg text-white hover:bg-red-500 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ═══ Step Navigation ═══ */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
              {["需求输入", "创意选择", "海报生成", "反馈优化", "定稿提案"].map((s, i) => {
                const n = i + 1;
                const active = step === n;
                const past = step > n;
                return (
                  <React.Fragment key={i}>
                    <button onClick={() => setStep(n)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        active ? "bg-amber-500 text-black" : past ? "bg-neutral-800 text-amber-400" : "bg-neutral-900 text-neutral-500 hover:text-neutral-300"
                      }`}>
                      {past ? <CheckCircle2 size={14} /> : <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-xs">{n}</span>}
                      {s}
                    </button>
                    {i < 4 && <ChevronRight size={14} className="text-neutral-700 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ═══════════════════════════════════════════
                Step 1: 需求输入
                ═══════════════════════════════════════════ */}
            {step === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                {/* 左栏：文字需求 */}
                <div className="bg-neutral-900/70 border border-neutral-800/60 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Sparkles size={18} />
                    <h3 className="font-bold text-base">从零创作</h3>
                  </div>

                  {/* 美术风格 */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">美术风格</label>
                    <div className="grid grid-cols-3 gap-2">
                      {ART_STYLES.map(s => {
                        const Icon = s.icon;
                        const active = selectedStyle === s.id;
                        return (
                          <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                              active ? "bg-amber-500/10 border-amber-500/40 text-amber-400" : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                            }`}>
                            <Icon size={18} />
                            <span className="text-xs font-medium leading-tight">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 画幅比例 */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">画幅比例</label>
                    <div className="flex gap-2">
                      {ASPECT_RATIOS.map(r => (
                        <button key={r.id} onClick={() => setSelectedRatio(r.id)}
                          className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                            selectedRatio === r.id ? "bg-amber-500/10 border-amber-500/40 text-amber-400" : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                          }`}>
                          <div className={`border-2 rounded-sm ${selectedRatio === r.id ? "border-amber-400" : "border-neutral-600"}`}
                            style={{ width: `${Math.max(16, r.w / Math.max(r.w, r.h) * 28)}px`, height: `${Math.max(16, r.h / Math.max(r.w, r.h) * 28)}px` }} />
                          <span className="text-xs font-mono">{r.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 风格参考图 */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">风格参考 (可选)</label>
                    <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      styleRefImg ? "border-amber-500/40 bg-amber-500/5" : "border-neutral-700 hover:border-neutral-500"
                    }`} onClick={() => styleRefInputRef.current?.click()}>
                      <input type="file" accept="image/*" className="hidden" ref={styleRefInputRef}
                        onChange={e => handleFileUpload(e, setStyleRefImg)} />
                      {styleRefImg ? (
                        <div className="flex items-center gap-3">
                          <img src={styleRefImg.url} className="w-14 h-14 rounded-lg object-cover" />
                          <span className="text-xs text-amber-400">点击更换</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-neutral-500 py-2">
                          <Upload size={18} />
                          <span className="text-xs">上传风格参考图</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 需求描述 */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">内容描述</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                      placeholder="描述你的海报需求：主题、文案、产品、场景、氛围..."
                      className="w-full h-32 p-4 bg-neutral-800/60 border border-neutral-700/50 rounded-xl text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
                  </div>

                  <button onClick={generateIdeas}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
                    <Sparkles size={18} />
                    生成 6 个创意方向
                  </button>
                </div>

                {/* 右栏：上传现有海报优化 */}
                <div className="bg-neutral-900/70 border border-neutral-800/60 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Edit3 size={18} />
                    <h3 className="font-bold text-base">上传优化</h3>
                  </div>
                  <p className="text-sm text-neutral-500">上传现有海报，输入反馈意见，直接生成 3 个优化版本。</p>

                  <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    uploadedPoster ? "border-emerald-500/40 bg-emerald-500/5" : "border-neutral-700 hover:border-neutral-500"
                  }`} onClick={() => uploadPosterRef.current?.click()}>
                    <input type="file" accept="image/*" className="hidden" ref={uploadPosterRef}
                      onChange={e => handleFileUpload(e, setUploadedPoster)} />
                    {uploadedPoster ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={uploadedPoster.url} className="max-h-48 rounded-lg object-contain" />
                        <span className="text-xs text-emerald-400">点击更换</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-neutral-500 py-8">
                        <Upload size={24} />
                        <span className="text-sm">上传海报原图</span>
                      </div>
                    )}
                  </div>

                  <textarea value={optimizeFeedback} onChange={e => setOptimizeFeedback(e.target.value)}
                    placeholder="优化需求：改颜色、调构图、换风格、加文案..."
                    className="w-full h-28 p-4 bg-neutral-800/60 border border-neutral-700/50 rounded-xl text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />

                  <button onClick={optimizeExisting} disabled={!uploadedPoster}
                    className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                      uploadedPoster ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    }`}>
                    <Edit3 size={18} />
                    直接优化出图 × 3
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════
                Step 2: 选择创意（可多选）
                ═══════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">选择创意方向</h2>
                  <p className="text-sm text-neutral-500">AI 生成了 6 个不同方向，可多选，每个方向将生成 3 张海报。</p>
                </div>

                {ideas.length === 0 ? (
                  <div className="text-center py-20 text-neutral-500">
                    <p>请先在 <button onClick={() => setStep(1)} className="text-amber-400 underline">步骤 1</button> 输入需求。</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ideas.map((idea, idx) => {
                        const selected = selectedIdeas.includes(idx);
                        return (
                          <div key={idx}
                            onClick={() => setSelectedIdeas(prev => selected ? prev.filter(i => i !== idx) : [...prev, idx])}
                            className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${
                              selected ? "border-amber-500 bg-amber-500/5" : "border-neutral-800 hover:border-neutral-600 bg-neutral-900/50"
                            }`}>
                            <div className="flex items-start justify-between mb-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                selected ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400"
                              }`}>#{idx + 1}</span>
                              {selected && <CheckCircle2 size={20} className="text-amber-500" />}
                            </div>
                            <p className="text-sm text-neutral-300 leading-relaxed line-clamp-4">{idea}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <span className="text-sm text-neutral-500">已选 {selectedIdeas.length} 个创意，将生成 {selectedIdeas.length * 3} 张海报</span>
                      <button onClick={generatePosters} disabled={selectedIdeas.length === 0}
                        className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                          selectedIdeas.length > 0 ? "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                        }`}>
                        开始生成海报 <ChevronRight size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════
                Step 3: 海报展示
                ═══════════════════════════════════════════ */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">生成的海报</h2>
                  <p className="text-sm text-neutral-500">点击海报可预览大图。选择要优化的海报进入下一步。</p>
                </div>

                {posters.length === 0 ? (
                  <div className="text-center py-20 text-neutral-500">暂无海报，请先生成。</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {posters.map(p => (
                      <div key={p.id} className="group relative bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:border-neutral-600 transition-all">
                        <div className="aspect-square relative cursor-pointer overflow-hidden" onClick={() => setPreviewImg(p.url)}>
                          <img src={p.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        </div>
                        <div className="p-3 flex items-center justify-between">
                          <p className="text-xs text-neutral-500 truncate flex-1">{p.ideaText}</p>
                          <div className="flex gap-1">
                            <button onClick={() => { setActivePoster(p); setStep(4); }}
                              title="优化此海报"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => { setFinalPoster(p); setStep(5); }}
                              title="选为定稿"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                              <Star size={14} />
                            </button>
                            <button onClick={() => downloadImage(p.url, `poster-${p.id}.png`)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all">
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════
                Step 4: 反馈优化
                ═══════════════════════════════════════════ */}
            {step === 4 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">反馈优化</h2>
                  <p className="text-sm text-neutral-500">上传参考图，通过 @图N 引用参考图描述修改需求。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 左：当前海报 */}
                  <div className="space-y-4">
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">正在优化的海报</label>
                    {activePoster ? (
                      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                        <img src={activePoster.url} className="w-full aspect-square object-cover cursor-pointer" onClick={() => setPreviewImg(activePoster.url)} />
                      </div>
                    ) : (
                      <div className="aspect-square bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-neutral-600 gap-3">
                        <ImageIcon size={32} />
                        <p className="text-sm">请从步骤3选择海报</p>
                        <button onClick={() => setStep(3)} className="text-xs text-amber-400 underline">返回选择</button>
                      </div>
                    )}
                  </div>

                  {/* 右：反馈区 */}
                  <div className="space-y-4">
                    {/* 参考图上传 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">参考图</label>
                        <button onClick={() => refImgInputRef.current?.click()}
                          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                          <Plus size={12} /> 添加
                        </button>
                        <input type="file" accept="image/*" multiple className="hidden" ref={refImgInputRef}
                          onChange={handleMultiFileUpload} />
                      </div>
                      {refImages.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          {refImages.map((img, idx) => (
                            <div key={img.id} className="relative group">
                              <img src={img.url} className="w-16 h-16 rounded-lg object-cover border border-neutral-700" />
                              <span className="absolute -top-1 -left-1 bg-amber-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <button onClick={() => setRefImages(prev => prev.filter(r => r.id !== img.id))}
                                className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-neutral-700 rounded-xl p-4 text-center text-neutral-600 text-xs cursor-pointer hover:border-neutral-500 transition-all"
                          onClick={() => refImgInputRef.current?.click()}>
                          点击上传参考图（可多张）
                        </div>
                      )}
                    </div>

                    {/* 反馈输入 */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">修改意见</label>
                      <div className="relative">
                        <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                          placeholder="例如：把@图1的产品替换到原图中，背景颜色改为深蓝..."
                          className="w-full h-36 p-4 bg-neutral-800/60 border border-neutral-700/50 rounded-xl text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
                        {refImages.length > 0 && (
                          <div className="absolute bottom-3 left-3 flex gap-1">
                            {refImages.map((_, idx) => (
                              <button key={idx}
                                onClick={() => setFeedbackText(prev => prev + `@图${idx + 1} `)}
                                className="px-2 py-1 bg-amber-500/15 text-amber-400 text-xs rounded-md hover:bg-amber-500/25 transition-all">
                                @图{idx + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button onClick={optimizePoster} disabled={!activePoster || !feedbackText.trim()}
                      className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        activePoster && feedbackText.trim() ? "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      }`}>
                      <RefreshCw size={18} />
                      应用反馈，生成 3 个优化版
                    </button>

                    <button onClick={() => setStep(3)}
                      className="w-full py-2.5 border border-neutral-700 text-neutral-400 rounded-xl hover:bg-neutral-800 transition-all text-sm">
                      返回查看所有海报
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════
                Step 5: 定稿 & 提案
                ═══════════════════════════════════════════ */}
            {step === 5 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">定稿与提案</h2>
                  <p className="text-sm text-neutral-500">为最终定稿的海报生成专业提案说明。</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 定稿海报 */}
                  <div className="space-y-4">
                    {finalPoster ? (
                      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                        <img src={finalPoster.url} className="w-full object-contain cursor-pointer" onClick={() => setPreviewImg(finalPoster.url)} />
                        <div className="p-4 flex items-center justify-between">
                          <span className="text-xs text-neutral-500">{finalPoster.ideaText}</span>
                          <button onClick={() => downloadImage(finalPoster.url, "final-poster.png")}
                            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                            <Download size={14} /> 下载定稿
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-neutral-600 gap-3">
                        <Star size={32} />
                        <p className="text-sm">请从步骤3选择定稿海报</p>
                        <button onClick={() => setStep(3)} className="text-xs text-amber-400 underline">返回选择</button>
                      </div>
                    )}

                    {/* 选择其他海报作为定稿 */}
                    {posters.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">更换定稿</label>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {posters.slice(0, 8).map(p => (
                            <img key={p.id} src={p.url} onClick={() => setFinalPoster(p)}
                              className={`w-16 h-16 rounded-lg object-cover cursor-pointer border-2 shrink-0 transition-all ${
                                finalPoster?.id === p.id ? "border-amber-500" : "border-neutral-700 hover:border-neutral-500"
                              }`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 提案区 */}
                  <div className="space-y-4">
                    {!proposalText ? (
                      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
                        <FileText size={32} className="mx-auto text-neutral-600 mb-4" />
                        <h3 className="font-bold text-white mb-2">生成提案说明</h3>
                        <p className="text-sm text-neutral-500 mb-6">AI 将分析海报视觉元素，撰写专业提案文档。</p>
                        <button onClick={generateProposal} disabled={!finalPoster}
                          className={`px-8 py-3 font-bold rounded-xl transition-all inline-flex items-center gap-2 ${
                            finalPoster ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                          }`}>
                          <Sparkles size={18} /> 生成提案
                        </button>
                      </div>
                    ) : (
                      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-h-[600px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-white flex items-center gap-2">
                            <FileText size={18} className="text-amber-400" /> 提案说明
                          </h3>
                          <button onClick={() => navigator.clipboard.writeText(proposalText)}
                            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-800 transition-all">
                            <Copy size={12} /> 复制
                          </button>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none">
                          {proposalText.split("\n").map((line, i) => (
                            <p key={i} className={`${line.startsWith("#") || line.startsWith("**") ? "font-bold text-white" : "text-neutral-300"} mb-2 text-sm leading-relaxed`}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => { setProposalText(""); generateProposal(); }}
                        disabled={!finalPoster}
                        className="flex-1 py-2.5 border border-neutral-700 text-neutral-400 rounded-xl hover:bg-neutral-800 transition-all text-sm flex items-center justify-center gap-2">
                        <RefreshCw size={14} /> 重新生成
                      </button>
                      <button onClick={() => setStep(3)}
                        className="flex-1 py-2.5 border border-neutral-700 text-neutral-400 rounded-xl hover:bg-neutral-800 transition-all text-sm">
                        返回海报列表
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
