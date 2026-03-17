export const config = {
  runtime: "nodejs",
};

export default function handler(_req: any, res: any) {
  const rawBaseUrl = process.env.POSTER_API_BASE_URL || process.env.OPENAI_BASE_URL || "https://ai.scd666.com";
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "").replace(/\/v1$/i, "");
  const openaiBaseUrl = rawBaseUrl.replace(/\/+$/, "").endsWith("/v1")
    ? rawBaseUrl.replace(/\/+$/, "")
    : `${normalizedBaseUrl}/v1`;

  res.status(200).json({
    ok: true,
    configured: Boolean(process.env.POSTER_API_KEY || process.env.OPENAI_API_KEY),
    envKeys: {
      hasPosterApiKey: Boolean(process.env.POSTER_API_KEY),
      hasPosterBaseUrl: Boolean(process.env.POSTER_API_BASE_URL),
      hasOpenAiApiKey: Boolean(process.env.OPENAI_API_KEY),
      hasOpenAiBaseUrl: Boolean(process.env.OPENAI_BASE_URL),
    },
    baseUrl: rawBaseUrl,
    normalizedBaseUrl,
    openaiBaseUrl,
    textModel: process.env.POSTER_TEXT_MODEL || "deepseek-v3.2-exp",
    tips: [
      "如果 configured 为 false，优先检查 Vercel 环境变量是否已重新部署生效。",
      "如果 OPENAI_BASE_URL 已包含 /v1，系统会自动避免重复拼接。",
      "MJ 请求会自动使用去掉 /v1 后的根地址。",
    ],
  });
}
