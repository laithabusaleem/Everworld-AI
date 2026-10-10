import path from "node:path";

export type AppConfig = {
  port: number;
  host: string;
  dbPath: string;
  modelProvider: "rules" | "openai";
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  requestTimeoutMs: number;
  corsOrigin: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? "127.0.0.1",
    dbPath:
      env.DATABASE_PATH ??
      path.join(process.cwd(), "data", "everworld.sqlite"),
    modelProvider: env.MODEL_PROVIDER === "openai" ? "openai" : "rules",
    openaiBaseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiApiKey: env.OPENAI_API_KEY ?? "",
    openaiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 30000),
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:5173",
  };
}

export function llmConfigured(config: AppConfig): boolean {
  return config.modelProvider === "openai" && Boolean(config.openaiApiKey);
}
