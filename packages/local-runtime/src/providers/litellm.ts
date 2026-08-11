import OpenAI from "openai";
import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError
} from "../errors.js";
import type { CompletionProvider, CompletionRequest } from "./types.js";

export class LiteLlmCompletionProvider implements CompletionProvider {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: { apiKey: string; baseURL: string; model: string }) {
    this.model = options.model;
    this.name = `llm:${options.model}`;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: 45_000,
      maxRetries: 2
    });
  }

  async complete(input: CompletionRequest): Promise<string> {
    const request = {
      model: this.model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user }
      ],
      max_tokens: input.maxTokens,
      temperature: 0,
      chat_template_kwargs: { enable_thinking: false }
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
    try {
      const response = await this.client.chat.completions.create(request);
      const content = response.choices[0]?.message.content;
      return typeof content === "string" ? content.trim() : "";
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) throw new ProviderAuthenticationError();
      if (error instanceof OpenAI.RateLimitError) throw new ProviderRateLimitError();
      if (error instanceof OpenAI.APIConnectionTimeoutError) throw new ProviderTimeoutError();
      if (error instanceof OpenAI.APIConnectionError) throw new ProviderUnavailableError();
      throw error;
    }
  }
}
