import {
  getActionDefinition,
  type TransformAction,
  type TransformRequest
} from "@bank-ai/contracts";
import { TransformApiError, transformText } from "./api/transform-client.js";
import { changedResultWordIndexes, wordTokens } from "./diff/text-diff.js";
import { OfficeWordAdapter } from "./office/word-adapter.js";
import { renderActions } from "./ui/action-renderer.js";
import "./styles.css";

const word = new OfficeWordAdapter();
const renderedActions = renderActions(document.querySelector<HTMLElement>("#actions")!);
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const statusHeadingElement = document.querySelector<HTMLElement>("#status-heading")!;
const statusCardElement = document.querySelector<HTMLElement>(".status-card")!;
const previewElement = document.querySelector<HTMLElement>("#preview")!;
const originalElement = document.querySelector<HTMLParagraphElement>("#original")!;
const resultElement = document.querySelector<HTMLParagraphElement>("#result")!;
const acceptButton = document.querySelector<HTMLButtonElement>("#accept")!;
const rejectButton = document.querySelector<HTMLButtonElement>("#reject")!;

let pendingResult = "";
let pendingAction: TransformAction | undefined;

function renderHighlightedResult(source: string, result: string): void {
  const resultWords = wordTokens(result);
  const changed = changedResultWordIndexes(source, result);
  const fragment = document.createDocumentFragment();
  let offset = 0;
  resultWords.forEach((token, index) => {
    fragment.append(document.createTextNode(result.slice(offset, token.start)));
    if (changed.has(index)) {
      const mark = document.createElement("mark");
      mark.className = "change-token";
      mark.textContent = token.value;
      mark.title = "Изменено AI";
      fragment.append(mark);
    } else fragment.append(document.createTextNode(token.value));
    offset = token.end;
  });
  fragment.append(document.createTextNode(result.slice(offset)));
  resultElement.replaceChildren(fragment);
}

function resetPreview(): void {
  pendingResult = "";
  pendingAction = undefined;
  originalElement.textContent = "";
  resultElement.textContent = "";
  previewElement.hidden = false;
  previewElement.classList.add("is-empty");
  acceptButton.disabled = true;
  rejectButton.disabled = true;
}

function setBusy(isBusy: boolean): void {
  renderedActions.buttons.forEach((button) => (button.disabled = isBusy));
  renderedActions.optionSelects.forEach((select) => (select.disabled = isBusy));
  acceptButton.disabled = isBusy || !pendingResult;
  rejectButton.disabled = isBusy || !pendingResult;
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusCardElement.classList.toggle("is-error", isError);
  statusCardElement.classList.toggle("is-busy", !isError && message.startsWith("Обрабатываем"));
  statusHeadingElement.textContent = isError
    ? "Требуется внимание"
    : message.startsWith("Обрабатываем")
      ? "Обработка текста"
      : message.startsWith("Готово за") ? "Результат готов" : "Готово к работе";
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
    const text = await word.getSelectedText();
    if (!text) throw new Error("Сначала выделите текст в документе Word.");

    const payload: TransformRequest = { action, text };
    const option = getActionDefinition(action).option;
    if (option) {
      const selectedValue = renderedActions.optionSelects.get(action)?.value;
      if (selectedValue) Object.assign(payload, { [option.requestField]: selectedValue });
    }
    const response = await transformText(payload);
    pendingResult = response.result;
    pendingAction = action;
    originalElement.textContent = text;
    const prefix = getActionDefinition(action).resultPrefix;
    renderHighlightedResult(text, prefix ? `${prefix} ${response.result}` : response.result);
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

acceptButton.addEventListener("click", async () => {
  if (!pendingResult || !pendingAction) return;
  try {
    setBusy(true);
    const definition = getActionDefinition(pendingAction);
    if (definition.applyMode === "append") await word.appendAfterSelection(pendingResult, definition.resultPrefix);
    else await word.replaceSelection(pendingResult);
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
