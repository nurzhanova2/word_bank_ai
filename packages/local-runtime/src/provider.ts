import { LiteLlmCompletionProvider } from "./providers/litellm.js";
import { MockAiProvider } from "./providers/mock.js";
import type { AiProvider } from "./providers/types.js";
import { TransformService } from "./services/transform-service.js";

export type { AiProvider } from "./providers/types.js";
export { MockAiProvider } from "./providers/mock.js";
export { isAcceptableResult } from "./validators/result.js";

export class OpenAiProvider extends TransformService {
  constructor(options: { apiKey: string; baseURL: string; model: string }) {
    super(new LiteLlmCompletionProvider(options));
  }
}

export function createProvider(): AiProvider {
  const providerName = process.env.BANK_AI_PROVIDER ?? "mock";
  if (providerName === "mock") return new MockAiProvider();

  if (providerName === "openai" || providerName === "litellm" || providerName === "llm") {
    const apiKey = process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("Для AI-провайдера заполните LLM_API_KEY в настройках.");

    return new OpenAiProvider({
      apiKey,
      baseURL: process.env.LLM_API_BASE?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.LLM_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol"
    });
  }

  throw new Error(`Неизвестный AI provider: '${providerName}'.`);
}
