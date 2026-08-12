import type { TransformAction, TransformOptions } from "@bank-ai/contracts";
import { ResultValidationError } from "../errors.js";
import { optionInstruction } from "../actions/options.js";
import { actionPrompts } from "../actions/prompts.js";
import type { AiProvider, CompletionProvider } from "../providers/types.js";
import { protectRequisites, restoreProtectedResult } from "../validators/requisites.js";
import { protectParagraphBreaks, restoreParagraphBreaks } from "../validators/layout.js";
import { isAcceptableResult } from "../validators/result.js";

export class TransformService implements AiProvider {
  readonly name: string;

  constructor(private readonly completionProvider: CompletionProvider) {
    this.name = completionProvider.name;
  }

  async transform(action: TransformAction, text: string, options: TransformOptions = {}): Promise<string> {
    const layoutProtection = action === "summary"
      ? { protectedText: text, entries: [] }
      : protectParagraphBreaks(text);
    const protection = protectRequisites(layoutProtection.protectedText);
    const modeInstruction = optionInstruction(action, options);
    const markerInstruction = protection.entries.length > 0
      ? action === "summary"
        ? "Сохрани маркеры ключевых фактов без изменений. Маркеры второстепенных деталей можно опустить. Не дублируй маркеры."
        : "Сохрани каждый защищённый маркер без изменений ровно один раз."
      : "Не добавляй числа, ссылки, адреса электронной почты или иные реквизиты.";

    const maxAttempts = action === "translate" ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const correction = attempt === 0
        ? ""
        : action === "summary"
          ? "Предыдущее краткое содержание не прошло проверку. Сделай его короче и не изменяй защищённые маркеры."
          : "Предыдущий ответ не прошёл проверку защищённых данных. Выполни задачу заново и сохрани все маркеры.";
      const user = [
        correction,
        modeInstruction,
        markerInstruction,
        layoutProtection.entries.length > 0
          ? "Маркеры вида [[BANKAI:PAR:X]] обозначают границы абзацев. Сохрани каждый такой маркер ровно один раз и не меняй его."
          : "",
        "Обрабатывай только содержимое между тегами <source> и </source>. Не включай теги в ответ.",
        `<source>\n${protection.protectedText}\n</source>`
      ].filter(Boolean).join("\n\n");

      const protectedResult = await this.completionProvider.complete({
        system: actionPrompts[action],
        user,
        maxTokens: action === "summary" ? 3_500 : 2_000
      });

      try {
        const requisitesRestored = restoreProtectedResult(protection, protectedResult, {
          requireAll: action !== "summary"
        });
        const result = restoreParagraphBreaks(layoutProtection, requisitesRestored);
        if (isAcceptableResult(action, text, result)) return result;
      } catch {
        // Повторяем запрос с корректирующей инструкцией.
      }
    }

    throw new ResultValidationError();
  }
}
