import type { TransformAction, TransformOptions } from "@bank-ai/contracts";
import { optionInstruction } from "../actions/options.js";
import { actionPrompts } from "../actions/prompts.js";
import type { AiProvider, CompletionProvider } from "../providers/types.js";
import { protectRequisites, restoreProtectedResult } from "../validators/requisites.js";
import { isAcceptableResult } from "../validators/result.js";

export class ResultValidationError extends Error {
  constructor() {
    super("LLM изменила защищённые данные или вернула некорректный результат.");
    this.name = "ResultValidationError";
  }
}

export class TransformService implements AiProvider {
  readonly name: string;

  constructor(private readonly completionProvider: CompletionProvider) {
    this.name = completionProvider.name;
  }

  async transform(action: TransformAction, text: string, options: TransformOptions = {}): Promise<string> {
    const protection = protectRequisites(text);
    const modeInstruction = optionInstruction(action, options);
    const markerInstruction = protection.entries.length > 0
      ? action === "summary"
        ? "Сохрани маркеры ключевых фактов без изменений. Маркеры второстепенных деталей можно опустить. Не дублируй маркеры."
        : "Сохрани каждый защищённый маркер без изменений ровно один раз."
      : "Не добавляй числа, ссылки, адреса электронной почты или иные реквизиты.";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const correction = attempt === 0
        ? ""
        : action === "summary"
          ? "Предыдущее краткое содержание не прошло проверку. Сделай его короче и не изменяй защищённые маркеры."
          : "Предыдущий ответ не прошёл проверку защищённых данных. Выполни задачу заново и сохрани все маркеры.";
      const user = [
        correction,
        modeInstruction,
        markerInstruction,
        "Обрабатывай только содержимое между тегами <source> и </source>. Не включай теги в ответ.",
        `<source>\n${protection.protectedText}\n</source>`
      ].filter(Boolean).join("\n\n");

      const protectedResult = await this.completionProvider.complete({
        system: actionPrompts[action],
        user,
        maxTokens: action === "summary" ? 3_500 : 2_000
      });

      try {
        const result = restoreProtectedResult(protection, protectedResult, {
          requireAll: action !== "summary"
        });
        if (isAcceptableResult(action, text, result)) return result;
      } catch {
        // Повторяем запрос с корректирующей инструкцией.
      }
    }

    throw new ResultValidationError();
  }
}
