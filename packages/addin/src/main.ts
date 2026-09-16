import {
  APP_VERSION,
  getActionDefinition,
  type GrammarIssue,
  documentScopeDefinitions,
  type DocumentScope,
  type TransformAction,
  type TransformRequest
} from "@bank-ai/contracts";
import { checkGrammar, TransformApiError, createDocumentOperation, executeDocumentChunk, finalizeDocumentOperation, cancelDocumentOperation, transformText, type DocumentTransformResponse } from "./api/transform-client.js";
import { applySelectedGrammarIssues, appendComparisonParts, comparisonParts, grammarComparisonParts } from "./diff/text-diff.js";
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
const acceptLabelElement = document.querySelector<HTMLElement>("#accept-label")!;
const rejectButton = document.querySelector<HTMLButtonElement>("#reject")!;
const versionElement = document.querySelector<HTMLElement>("#app-version")!;
const grammarMetaElement = document.querySelector<HTMLElement>("#grammar-meta")!;
const grammarIssuesElement = document.querySelector<HTMLElement>("#grammar-issues")!;
const toneSelect = document.querySelector<HTMLSelectElement>("#tone-select")!;
const toneApplyButton = document.querySelector<HTMLButtonElement>("#tone-apply")!;
const scopeSelect = document.querySelector<HTMLSelectElement>("#document-scope")!;
const scopeWarning = document.querySelector<HTMLElement>("#scope-warning")!;
const scopeTabs = [...document.querySelectorAll<HTMLButtonElement>("[data-document-scope]")];
const cancelDocumentButton = document.querySelector<HTMLButtonElement>("#cancel-document")!;
const retryDocumentButton = document.querySelector<HTMLButtonElement>("#retry-document")!;
versionElement.textContent = `v${APP_VERSION}`;

scopeSelect.replaceChildren(...documentScopeDefinitions.map((scope) => {
  const option = document.createElement("option");
  option.value = scope.id;
  option.textContent = scope.id === "section" ? "Текущий раздел — недоступно" : scope.label;
  option.disabled = scope.id === "section";
  return option;
}));
scopeSelect.value = "selection";
scopeSelect.addEventListener("change", () => {
  const scope = scopeSelect.value as DocumentScope;
  scopeWarning.hidden = scope === "selection";
  scopeTabs.forEach((tab) => {
    const active = tab.dataset.documentScope === scope;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
});
scopeTabs.forEach((tab) => tab.addEventListener("click", () => {
  const scope = tab.dataset.documentScope as DocumentScope | undefined;
  if (!scope || scopeSelect.value === scope) return;
  scopeSelect.value = scope;
  scopeSelect.dispatchEvent(new Event("change"));
}));

let pendingResult = "";
let pendingAction: TransformAction | undefined;
let pendingSourceOoxml = "";
let pendingGrammarSource = "";
let pendingGrammarIssues: GrammarIssue[] = [];
let pendingDocument: { snapshot: Awaited<ReturnType<typeof word.getDocumentSnapshot>>; result: DocumentTransformResponse } | undefined;
let documentAbort: AbortController | undefined;
let activeDocumentOperation: { id: string; next: number; total: number } | undefined;
let activeDocumentContext: { snapshot: Awaited<ReturnType<typeof word.getDocumentSnapshot>>; action: TransformAction } | undefined;
let pendingDocumentSummary: { snapshot: Awaited<ReturnType<typeof word.getDocumentSnapshot>>; summary: string } | undefined;
const appliedGrammarIssueIndexes = new Set<number>();

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
  pendingDocumentSummary = undefined;
  pendingDocument = undefined; documentAbort = undefined; cancelDocumentButton.hidden = true; retryDocumentButton.hidden = true;
  pendingResult = "";
  pendingAction = undefined;
  pendingSourceOoxml = "";
  pendingGrammarSource = "";
  pendingGrammarIssues = [];
  appliedGrammarIssueIndexes.clear();
  changesElement.textContent = "";
  grammarMetaElement.hidden = true;
  grammarIssuesElement.hidden = true;
  grammarMetaElement.textContent = "";
  grammarIssuesElement.replaceChildren();
  previewElement.hidden = false;
  previewElement.classList.add("is-empty");
  acceptButton.disabled = true;
  acceptLabelElement.textContent = "Применить";
  rejectButton.disabled = true;
}

function setBusy(isBusy: boolean): void {
  document.body.dataset.busy = String(isBusy);
  renderedActions.buttons.forEach((button) => (button.disabled = isBusy));
  renderedActions.optionSelects.forEach((select) => (select.disabled = isBusy));
  toneSelect.disabled = isBusy;
  toneApplyButton.disabled = isBusy;
  scopeSelect.disabled = isBusy;
  scopeTabs.forEach((tab) => (tab.disabled = isBusy));
  acceptButton.disabled = isBusy || !pendingResult;
  rejectButton.disabled = isBusy || !pendingResult;
  grammarIssuesElement.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = isBusy || button.dataset.applied === "true";
  });
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusHeadingElement.closest(".ready-state")?.classList.toggle("is-error", isError);
  statusHeadingElement.textContent = isError
    ? "Требуется внимание"
    : message.startsWith("Обрабатываем")
      ? "Обработка текста"
      : message.startsWith("Готово за") ? "Результат готов" : "Готово к работе";
}

const languageLabels = { ru: "Русский", kk: "Қазақша", en: "English", mixed: "Смешанный", unknown: "Не определён" } as const;

async function applyOneGrammarIssue(issue: GrammarIssue, issueIndex: number): Promise<void> {
  if (appliedGrammarIssueIndexes.has(issueIndex)) return;
  const nextIndexes = new Set(appliedGrammarIssueIndexes).add(issueIndex);
  const selectedIssues = pendingGrammarIssues.filter((_candidate, index) => nextIndexes.has(index));
  const result = applySelectedGrammarIssues(pendingGrammarSource, selectedIssues);
  if (!pendingGrammarSource || result === pendingGrammarSource) return;
  try {
    setBusy(true);
    await word.replaceSelection(result, pendingSourceOoxml);
    appliedGrammarIssueIndexes.add(issueIndex);
    renderGrammarIssues(pendingGrammarIssues);
    setStatus(`Исправлено: ${appliedGrammarIssueIndexes.size} из ${pendingGrammarIssues.filter((candidate) => candidate.replacements[0] !== undefined).length}. Остальные исправления доступны ниже.`);
  } catch {
    setStatus("Word не смог применить выбранное исправление.", true);
  } finally {
    setBusy(false);
  }
}

function renderGrammarIssues(issues: Awaited<ReturnType<typeof checkGrammar>>["issues"]): void {
  grammarIssuesElement.replaceChildren(...issues.slice(0, 24).map((issue, issueIndex) => {
    const card = document.createElement("article");
    card.className = "grammar-issue";
    const title = document.createElement("strong");
    title.textContent = issue.replacements[0] !== undefined && issue.autoApply !== false
      ? `${issue.original || "Фрагмент"} → ${issue.replacements[0]}`
      : `${issue.original || "Фрагмент"} — требуется проверка`;
    const explanation = document.createElement("p");
    const dictionarySuggestions = issue.suggestions?.length
      ? ` Варианты словаря: ${issue.suggestions.join(", ")}. Они не применяются автоматически.`
      : "";
    explanation.textContent = `${issue.message}${dictionarySuggestions}`;
    card.append(title, explanation);
    if (issue.autoApply !== false && issue.replacements[0] !== undefined) {
      const fixButton = document.createElement("button");
      fixButton.type = "button";
      fixButton.className = "grammar-fix-one";
      const isApplied = appliedGrammarIssueIndexes.has(issueIndex);
      fixButton.textContent = isApplied ? "Исправлено" : "Исправить";
      fixButton.title = "Исправить эту ошибку";
      fixButton.dataset.applied = String(isApplied);
      fixButton.disabled = isApplied;
      card.classList.toggle("is-applied", isApplied);
      fixButton.addEventListener("click", () => void applyOneGrammarIssue(issue, issueIndex));
      card.append(fixButton);
    }
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
    if (scopeSelect.value === "document" && action !== "grammar") { await transformWholeDocument(action); return; }
    setStatus("Обрабатываем выделенный текст…");
    const selection = await word.getSelectedContent();
    const text = selection.text;
    if (!text) throw new Error("Сначала выделите текст в документе Word.");

    if (action === "grammar") {
      const grammar = await checkGrammar(text);
      pendingResult = grammar.correctedText === text ? "" : grammar.correctedText;
      pendingAction = action;
      pendingSourceOoxml = selection.ooxml;
      pendingGrammarSource = text;
      pendingGrammarIssues = grammar.issues;
      acceptLabelElement.textContent = "Исправить всё";
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

async function transformWholeDocument(action: TransformAction): Promise<void> {
  setStatus("Чтение документа…"); cancelDocumentButton.hidden = false; documentAbort = new AbortController();
  const snapshot = await word.getDocumentSnapshot();
  const option = getActionDefinition(action).option;
  const request: { action: TransformAction; paragraphs: { id: string; index: number; text: string }[]; targetLanguage?: "ru" | "kk" | "en"; targetTone?: "neutral" | "polite" | "strict" | "diplomatic" } = { action, paragraphs: snapshot.paragraphs.map(({ id, index, text }) => ({ id, index, text })) };
  if (option) { const value = renderedActions.optionSelects.get(action)?.value; if (value) Object.assign(request, { [option.requestField]: value }); }
  setStatus(`Обработка документа: 0 из ${snapshot.paragraphs.length} абзацев…`);
  const operation = await createDocumentOperation(request, fetch, documentAbort.signal); activeDocumentOperation = { id: operation.operationId, next: 0, total: operation.totalChunks }; activeDocumentContext = { snapshot, action };
  await continueDocumentOperation();
  await finalizeActiveDocumentOperation();
}

async function finalizeActiveDocumentOperation(): Promise<void> {
  if (!activeDocumentOperation || !activeDocumentContext || !documentAbort || documentAbort.signal.aborted) return;
  setStatus("Подготовка результата…");
  const result = await finalizeDocumentOperation(activeDocumentOperation.id, fetch, documentAbort.signal);
  const { snapshot, action } = activeDocumentContext;
  if ("summary" in result) {
    pendingDocumentSummary = { snapshot, summary: result.summary }; activeDocumentOperation = undefined; activeDocumentContext = undefined; pendingAction = action; pendingResult = result.summary;
    changesElement.textContent = `РЕЗЮМЕ:\n${result.summary}`; previewElement.hidden = false; previewElement.classList.remove("is-empty"); acceptLabelElement.textContent = "Добавить"; setStatus("Резюме готово. Проверьте результат."); cancelDocumentButton.hidden = true; return;
  }
  pendingDocument = { snapshot, result }; activeDocumentOperation = undefined; activeDocumentContext = undefined; pendingAction = action; pendingResult = result.paragraphs.some((paragraph) => paragraph.changed) ? "document" : "";
  changesElement.textContent = `Изменено абзацев: ${result.paragraphs.filter((paragraph) => paragraph.changed).length} из ${result.paragraphs.length}.`;
  previewElement.hidden = false; previewElement.classList.remove("is-empty"); acceptLabelElement.textContent = action === "summary" ? "Добавить" : "Применить";
  setStatus("Предпросмотр документа готов. Проверьте изменения."); cancelDocumentButton.hidden = true;
}

async function continueDocumentOperation(): Promise<void> {
  if (!activeDocumentOperation || !documentAbort) return;
  try {
    for (; activeDocumentOperation.next < activeDocumentOperation.total; activeDocumentOperation.next += 1) {
      const progress = await executeDocumentChunk(activeDocumentOperation.id, activeDocumentOperation.next, fetch, documentAbort.signal);
      setStatus(`Обработка документа: ${progress.completed} из ${progress.total} блоков…`);
    }
  } catch (error) {
    if (documentAbort.signal.aborted) return;
    retryDocumentButton.hidden = false; cancelDocumentButton.hidden = false;
    setStatus(`Не удалось обработать блок ${activeDocumentOperation.next + 1} из ${activeDocumentOperation.total}.`, true);
    throw error;
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
    if (pendingDocumentSummary) { await word.appendDocumentSummary(pendingDocumentSummary.snapshot, pendingDocumentSummary.summary); resetPreview(); setStatus("Резюме добавлено в конец документа."); return; }
    if (pendingDocument) { await word.applyDocumentSnapshot(pendingDocument.snapshot, pendingDocument.result.paragraphs); resetPreview(); setStatus("Изменения документа применены."); return; }
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

cancelDocumentButton.addEventListener("click", () => { documentAbort?.abort(); if (activeDocumentOperation) void cancelDocumentOperation(activeDocumentOperation.id).catch(() => undefined); activeDocumentOperation = undefined; resetPreview(); setStatus("Операция отменена."); });
retryDocumentButton.addEventListener("click", () => { retryDocumentButton.hidden = true; void (async () => { await continueDocumentOperation(); await finalizeActiveDocumentOperation(); })().catch(() => undefined); });

rejectButton.addEventListener("click", async () => {
  try {
    setBusy(true);
    if (pendingAction === "grammar" && appliedGrammarIssueIndexes.size > 0) {
      await word.replaceSelection(pendingGrammarSource, pendingSourceOoxml);
    }
    resetPreview();
    setStatus("Изменение отклонено. Исходный текст восстановлен.");
  } catch {
    setStatus("Word не смог восстановить исходный текст.", true);
  } finally {
    setBusy(false);
  }
});

Office.onReady((info) => {
  setStatus(info.host === Office.HostType.Word ? "Готово к работе." : "Откройте дополнение в Microsoft Word.", info.host !== Office.HostType.Word);
});
