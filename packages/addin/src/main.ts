import {
  APP_VERSION,
  getActionDefinition,
  type TransformAction,
  type TransformRequest
} from "@bank-ai/contracts";
import { checkGrammar, TransformApiError, transformText } from "./api/transform-client.js";
import { appendComparisonParts, comparisonParts, grammarComparisonParts } from "./diff/text-diff.js";
import { OfficeWordAdapter } from "./office/word-adapter.js";
import { renderActions } from "./ui/action-renderer.js";
import "./styles.css";

const word = new OfficeWordAdapter();
const renderedActions = renderActions(document.querySelector<HTMLElement>("#actions")!);
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const statusHeadingElement = document.querySelector<HTMLElement>("#status-heading")!;
const previewElement = document.querySelector<HTMLElement>("#preview")!;
const changesElement = document.querySelector<HTMLParagraphElement>("#changes")!;
const acceptButton = document.querySelector<HTMLButtonElement>("#accept")!;
const rejectButton = document.querySelector<HTMLButtonElement>("#reject")!;
const versionElement = document.querySelector<HTMLElement>("#app-version")!;
const grammarMetaElement = document.querySelector<HTMLElement>("#grammar-meta")!;
const grammarIssuesElement = document.querySelector<HTMLElement>("#grammar-issues")!;
const toneSelect = document.querySelector<HTMLSelectElement>("#tone-select")!;
const toneApplyButton = document.querySelector<HTMLButtonElement>("#tone-apply")!;
versionElement.textContent = `v${APP_VERSION}`;

let pendingResult = "";
let pendingAction: TransformAction | undefined;
let pendingSourceOoxml = "";

function renderHighlightedResult(source: string, result: string): void {
  renderComparison(comparisonParts(source, result));
}

function renderComparison(parts: ReturnType<typeof comparisonParts>): void {
  changesElement.replaceChildren(...parts.map((part) => {
    if (part.kind === "plain") return document.createTextNode(part.text);
    const mark = document.createElement("mark");
    mark.className = part.kind === "removed" ? "removed-token" : part.kind === "added" ? "change-token" : "review-token";
    mark.textContent = part.text;
    return mark;
  }));
}

function renderGrammarComparison(
  source: string,
  result: string,
  issues: Awaited<ReturnType<typeof checkGrammar>>["issues"]
): void {
  const parts = grammarComparisonParts(source, issues);
  renderComparison(parts);
  [...changesElement.querySelectorAll<HTMLElement>("mark")].forEach((mark, index) => {
    const part = parts.filter((candidate) => candidate.kind !== "plain")[index];
    if (!part) return;
    mark.title = part.kind === "review" ? "Требуется ручная проверка" : part.kind === "removed" ? "Было" : "Стало";
  });
}

function resetPreview(): void {
  pendingResult = "";
  pendingAction = undefined;
  pendingSourceOoxml = "";
  changesElement.textContent = "";
  grammarMetaElement.hidden = true;
  grammarIssuesElement.hidden = true;
  grammarMetaElement.textContent = "";
  grammarIssuesElement.replaceChildren();
  previewElement.hidden = false;
  previewElement.classList.add("is-empty");
  acceptButton.disabled = true;
  rejectButton.disabled = true;
}

function setBusy(isBusy: boolean): void {
  renderedActions.buttons.forEach((button) => (button.disabled = isBusy));
  renderedActions.optionSelects.forEach((select) => (select.disabled = isBusy));
  toneSelect.disabled = isBusy;
  toneApplyButton.disabled = isBusy;
  acceptButton.disabled = isBusy || !pendingResult;
  rejectButton.disabled = isBusy || !pendingResult;
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusHeadingElement.textContent = isError
    ? "Требуется внимание"
    : message.startsWith("Обрабатываем")
      ? "Обработка текста"
      : message.startsWith("Готово за") ? "Результат готов" : "Готово к работе";
}

const languageLabels = { ru: "Русский", kk: "Қазақша", en: "English", mixed: "Смешанный", unknown: "Не определён" } as const;

function renderGrammarIssues(issues: Awaited<ReturnType<typeof checkGrammar>>["issues"]): void {
  grammarIssuesElement.replaceChildren(...issues.slice(0, 12).map((issue) => {
    const card = document.createElement("article");
    card.className = "grammar-issue";
    const title = document.createElement("strong");
    title.textContent = `${issue.original || "Фрагмент"} → ${issue.replacements[0] || "Проверьте фрагмент"}`;
    const explanation = document.createElement("p");
    explanation.textContent = issue.message;
    card.append(title, explanation);
    return card;
  }));
  grammarIssuesElement.hidden = issues.length === 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof TransformApiError) {
    return error.operationId ? `${error.message} Код операции: ${error.operationId}.` : error.message;
  }
  return error instanceof Error ? error.message : "Неизвестная ошибка.";
}

async function transform(action: TransformAction): Promise<void> {
  try {
    setBusy(true);
    resetPreview();
    setStatus("Обрабатываем выделенный текст…");
    const selection = await word.getSelectedContent();
    const text = selection.text;
    if (!text) throw new Error("Сначала выделите текст в документе Word.");

    if (action === "grammar") {
      const grammar = await checkGrammar(text);
      pendingResult = grammar.correctedText === text ? "" : grammar.correctedText;
      pendingAction = action;
      pendingSourceOoxml = selection.ooxml;
      renderGrammarComparison(text, grammar.correctedText, grammar.issues);
      renderGrammarIssues(grammar.issues);
      grammarMetaElement.textContent = `Язык: ${languageLabels[grammar.language]}. Проверка: ${grammar.engines.join(" + ") || "нет доступного движка"}. Ошибок: ${grammar.issues.length}.`;
      grammarMetaElement.hidden = false;
      previewElement.classList.remove("is-empty");
      setStatus(`Готово за ${grammar.durationMs} мс. Найдено ошибок: ${grammar.issues.length}.`);
      return;
    }

    const payload: TransformRequest = { action, text };
    const option = getActionDefinition(action).option;
    if (option) {
      const selectedValue = renderedActions.optionSelects.get(action)?.value;
      if (selectedValue) Object.assign(payload, { [option.requestField]: selectedValue });
    }
    const response = await transformText(payload);
    pendingResult = response.result;
    pendingAction = action;
    pendingSourceOoxml = selection.ooxml;
    const prefix = getActionDefinition(action).resultPrefix;
    if (prefix) {
      const appended = `${prefix} ${response.result}`;
      renderComparison(appendComparisonParts(text, appended));
    } else renderHighlightedResult(text, response.result);
    previewElement.hidden = false;
    previewElement.classList.remove("is-empty");
    setStatus(`Готово за ${response.durationMs} мс. Проверьте результат.`);
  } catch (error) {
    setStatus(errorMessage(error), true);
  } finally {
    setBusy(false);
  }
}

renderedActions.buttons.forEach((button) => {
  button.addEventListener("click", () => void transform(button.dataset.action as TransformAction));
});

toneApplyButton.addEventListener("click", () => {
  void transformWithTone();
});

async function transformWithTone(): Promise<void> {
  const virtualSelect = renderedActions.optionSelects.get("tone");
  if (virtualSelect) virtualSelect.value = toneSelect.value;
  else renderedActions.optionSelects.set("tone", toneSelect);
  await transform("tone");
}

acceptButton.addEventListener("click", async () => {
  if (!pendingResult || !pendingAction) return;
  try {
    setBusy(true);
    const definition = getActionDefinition(pendingAction);
    if (definition.applyMode === "append") await word.appendAfterSelection(pendingResult, definition.resultPrefix, pendingSourceOoxml);
    else await word.replaceSelection(pendingResult, pendingSourceOoxml);
    const appliedMode = definition.applyMode;
    resetPreview();
    setStatus(appliedMode === "append" ? "Результат добавлен после выделенного текста." : "Изменение применено к документу.");
  } catch {
    setStatus("Word не смог применить результат к выделенному тексту.", true);
  } finally {
    setBusy(false);
  }
});

rejectButton.addEventListener("click", () => {
  resetPreview();
  setStatus("Изменение отклонено. Документ не изменён.");
});

Office.onReady((info) => {
  setStatus(info.host === Office.HostType.Word ? "Готово к работе." : "Откройте дополнение в Microsoft Word.", info.host !== Office.HostType.Word);
});
