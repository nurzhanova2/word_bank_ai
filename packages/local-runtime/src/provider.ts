import type { TransformAction } from "@bank-ai/contracts";
import OpenAI from "openai";

export interface AiProvider {
  readonly name: string;
  transform(action: TransformAction, text: string): Promise<string>;
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async transform(action: TransformAction, text: string): Promise<string> {
    const normalized = text.replace(/\s+/g, " ").trim();

    switch (action) {
      case "rewrite":
        return `Улучшенная формулировка: ${normalized}`;
      case "shorten": {
        const words = normalized.split(" ");
        return words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : normalized;
      }
      case "formalize":
        return `В официально-деловом стиле: ${normalized}`;
    }

    throw new Error("Неподдерживаемое действие.");
  }
}

const actionInstructions: Record<TransformAction, string> = {
  rewrite: [
    "Перепиши текст яснее и естественнее, сохранив исходный смысл.",
    "Не добавляй новые факты. Не меняй числа, даты, имена и реквизиты.",
    "Верни только готовый текст без пояснений, кавычек и вводных фраз."
  ].join(" "),
  shorten: [
    "Сократи текст, сохранив ключевую информацию и исходный смысл.",
    "Не меняй числа, даты, имена и реквизиты. Не добавляй новые факты.",
    "Верни только сокращённый текст без пояснений, кавычек и вводных фраз."
  ].join(" "),
  formalize: [
    "Перепиши текст в ясном официально-деловом стиле.",
    "Сохрани смысл, числа, даты, имена и реквизиты без изменений.",
    "Не добавляй новые факты. Верни только готовый текст без пояснений и кавычек."
  ].join(" ")
};

export class OpenAiProvider implements AiProvider {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: { apiKey: string; baseURL: string; model: string }) {
    this.model = options.model;
    this.name = `openai:${options.model}`;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: 45_000,
      maxRetries: 2
    });
  }

  async transform(action: TransformAction, text: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: actionInstructions[action],
      input: text,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      max_output_tokens: 2_000
    });

    const result = response.output_text.trim();
    if (!result) {
      throw new Error("OpenAI вернул пустой результат.");
    }

    return result;
  }
}

export function createProvider(): AiProvider {
  const providerName = process.env.BANK_AI_PROVIDER ?? "mock";
  if (providerName === "mock") {
    return new MockAiProvider();
  }

  if (providerName === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Для BANK_AI_PROVIDER=openai заполните OPENAI_API_KEY в .env.");
    }

    return new OpenAiProvider({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol"
    });
  }

  throw new Error(`Неизвестный AI provider: '${providerName}'.`);
}
