import type { TransformAction, TransformOptions } from "@bank-ai/contracts";
import type { AiProvider } from "./types.js";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async transform(action: TransformAction, text: string, options: TransformOptions = {}): Promise<string> {
    const normalized = text.replace(/\s+/g, " ").trim();
    switch (action) {
      case "rewrite": return `Улучшенная формулировка: ${normalized}`;
      case "shorten": {
        const words = normalized.split(" ");
        return words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : normalized;
      }
      case "formalize": return `В официально-деловом стиле: ${normalized}`;
      case "grammar": return normalized;
      case "translate": return `[${options.targetLanguage ?? "ru"}] ${normalized}`;
      case "expand": return `${normalized} Дополнительное пояснение в демонстрационном режиме.`;
      case "tone": return `[${options.targetTone ?? "neutral"}] ${normalized}`;
      case "summary": return normalized.split(/(?<=[.!?])\s+/u).slice(0, 2).join(" ");
    }
  }
}
