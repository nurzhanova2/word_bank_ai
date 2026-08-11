import {
  actionDefinitions,
  getActionDefinition,
  type ApiError,
  type TransformAction,
  type TransformRequest,
  type TransformResponse
} from "@bank-ai/contracts";
import "./styles.css";

const actionIcons: Partial<Record<TransformAction, string>> = {
  rewrite: '<path d="m4 16 9.8-9.8a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Zm8.4-8.4 3 3M12 20h9" />',
  shorten: '<circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.5 8.5 11 8.5M8.5 15.5 19.5 7" />',
  summary: '<path d="M5 5h14M5 9h14M5 13h9M5 17h11M5 21h7" />',
  formalize: '<path d="M6 3h9l4 4v14H6V3Z" /><path d="M15 3v5h4M9 13h7M9 17h5M9 9h2" />',
  grammar: '<path d="M5 4h9M9.5 4v12M6.5 10h6M15 16l2.2 2.2L21 13" />',
  translate: '<path d="M4 5h10M9 3v2c0 5-2 8-5 10M6 10c2 2 4 3 7 4M15 10l4 11M13.5 17h7" />',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M8 12h8M12 8v8" />',
  tone: '<path d="M4 6h16M7 12h10M10 18h4" /><circle cx="4" cy="6" r="1" /><circle cx="17" cy="12" r="1" /><circle cx="10" cy="18" r="1" />'
};

function renderActions(): void {
  const container = document.querySelector<HTMLElement>("#actions")!;
  for (const definition of actionDefinitions) {
    const card = document.createElement(definition.option ? "div" : "button");
    card.className = `action-card${definition.option ? " action-card-option" : ""}`;
    if (card instanceof HTMLButtonElement) {
      card.type = "button";
      card.dataset.action = definition.id;
    }

    const icon = document.createElement("span");
    icon.className = "action-icon";
    icon.ariaHidden = "true";
    icon.innerHTML = `<svg viewBox="0 0 24 24">${actionIcons[definition.id] ?? '<path d="M12 4v16M4 12h16" />'}</svg>`;

    const copy = document.createElement("span");
    copy.className = "action-copy";
    const title = document.createElement("strong");
    title.textContent = definition.title;
    copy.append(title);

    if (definition.option) {
      const select = document.createElement("select");
      select.className = "action-select";
      select.dataset.actionOption = definition.id;
      select.ariaLabel = definition.option.ariaLabel;
      for (const choice of definition.option.choices) {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        select.append(option);
      }
      copy.append(select);
    } else {
      const description = document.createElement("small");
      description.textContent = definition.description;
      copy.append(description);
    }

    const trigger = document.createElement(definition.option ? "button" : "span");
    trigger.className = definition.option ? "action-go" : "chevron";
    trigger.textContent = "›";
    trigger.ariaLabel = definition.option ? definition.title : null;
    if (trigger instanceof HTMLButtonElement) {
      trigger.type = "button";
      trigger.dataset.action = definition.id;
    } else {
      trigger.ariaHidden = "true";
    }
    card.append(icon, copy, trigger);
    container.append(card);
  }
}

renderActions();

const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const statusHeadingElement = document.querySelector<HTMLElement>("#status-heading")!;
const statusCardElement = document.querySelector<HTMLElement>(".status-card")!;
const previewElement = document.querySelector<HTMLElement>("#preview")!;
const originalElement = document.querySelector<HTMLParagraphElement>("#original")!;
const resultElement = document.querySelector<HTMLParagraphElement>("#result")!;
const actionButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-action]")];
const optionSelects = new Map<TransformAction, HTMLSelectElement>(
  [...document.querySelectorAll<HTMLSelectElement>("[data-action-option]")].map((select) => [
    select.dataset.actionOption as TransformAction,
    select
  ])
);
const acceptButton = document.querySelector<HTMLButtonElement>("#accept")!;
const rejectButton = document.querySelector<HTMLButtonElement>("#reject")!;

let pendingResult = "";
let pendingAction: TransformAction | undefined;

interface WordToken {
  value: string;
  start: number;
  end: number;
}

function wordTokens(text: string): WordToken[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)].map((match) => ({
    value: match[0],
    start: match.index,
    end: match.index + match[0].length
  }));
}

function unchangedResultWordIndexes(source: string, result: string): Set<number> {
  const sourceWords = wordTokens(source);
  const resultWords = wordTokens(result);
  const unchanged = new Set<number>();
  const lookAhead = 12;
  let sourceIndex = 0;
  let resultIndex = 0;

  while (sourceIndex < sourceWords.length && resultIndex < resultWords.length) {
    const sourceWord = sourceWords[sourceIndex]!;
    const resultWord = resultWords[resultIndex]!;

    if (sourceWord.value === resultWord.value) {
      unchanged.add(resultIndex);
      sourceIndex += 1;
      resultIndex += 1;
      continue;
    }

    const sourceMatch = sourceWords
      .slice(sourceIndex + 1, sourceIndex + lookAhead + 1)
      .findIndex((token) => token.value === resultWord.value);
    const resultMatch = resultWords
      .slice(resultIndex + 1, resultIndex + lookAhead + 1)
      .findIndex((token) => token.value === sourceWord.value);

    if (resultMatch >= 0 && (sourceMatch < 0 || resultMatch <= sourceMatch)) {
      resultIndex += 1;
    } else if (sourceMatch >= 0) {
      sourceIndex += 1;
    } else {
      sourceIndex += 1;
      resultIndex += 1;
    }
  }

  return unchanged;
}

function renderHighlightedResult(source: string, result: string): void {
  const resultWords = wordTokens(result);
  const unchanged = unchangedResultWordIndexes(source, result);
  const fragment = document.createDocumentFragment();
  let offset = 0;

  resultWords.forEach((token, index) => {
    fragment.append(document.createTextNode(result.slice(offset, token.start)));
    if (unchanged.has(index)) {
      fragment.append(document.createTextNode(token.value));
    } else {
      const mark = document.createElement("mark");
      mark.className = "change-token";
      mark.textContent = token.value;
      mark.title = "Изменено AI";
      fragment.append(mark);
    }
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
  actionButtons.forEach((button) => (button.disabled = isBusy));
  optionSelects.forEach((select) => (select.disabled = isBusy));
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
      : message.startsWith("Готово за")
        ? "Результат готов"
        : "Готово к работе";
}

async function getSelectedText(): Promise<string> {
  return Word.run(async (context) => {
    const range = context.document.getSelection();
    range.load("text");
    await context.sync();
    return range.text.trim();
  });
}

async function replaceSelection(text: string): Promise<void> {
  await Word.run(async (context) => {
    const range = context.document.getSelection();
    range.insertText(text, Word.InsertLocation.replace);
    range.select();
    await context.sync();
  });
}

async function appendResult(text: string, prefix = ""): Promise<void> {
  await Word.run(async (context) => {
    const range = context.document.getSelection();
    const insertedRange = range.insertText(`\n\n${prefix ? `${prefix} ` : ""}${text}`, Word.InsertLocation.after);
    insertedRange.select();
    await context.sync();
  });
}

async function transform(action: TransformAction): Promise<void> {
  try {
    setBusy(true);
    resetPreview();
    setStatus("Обрабатываем выделенный текст…");

    const text = await getSelectedText();
    if (!text) {
      throw new Error("Сначала выделите текст в документе Word.");
    }

    const payload: TransformRequest = { action, text };
    const option = getActionDefinition(action).option;
    if (option) {
      const selectedValue = optionSelects.get(action)?.value;
      if (selectedValue) Object.assign(payload, { [option.requestField]: selectedValue });
    }

    const response = await fetch("/api/v1/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = (await response.json()) as TransformResponse | ApiError;
    if (!response.ok || "error" in body) {
      throw new Error("error" in body ? body.error.message : "Ошибка локального API.");
    }

    pendingResult = body.result;
    pendingAction = action;
    originalElement.textContent = text;
    const resultPrefix = getActionDefinition(action).resultPrefix;
    renderHighlightedResult(text, resultPrefix ? `${resultPrefix} ${body.result}` : body.result);
    previewElement.hidden = false;
    previewElement.classList.remove("is-empty");
    setStatus(`Готово за ${body.durationMs} мс. Проверьте результат.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Неизвестная ошибка.", true);
  } finally {
    setBusy(false);
  }
}

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    void transform(button.dataset.action as TransformAction);
  });
});

acceptButton.addEventListener("click", async () => {
  if (!pendingResult || !pendingAction) return;
  try {
    setBusy(true);
    const definition = getActionDefinition(pendingAction);
    if (definition.applyMode === "append") {
      await appendResult(pendingResult, definition.resultPrefix);
    } else {
      await replaceSelection(pendingResult);
    }
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
  if (info.host === Office.HostType.Word) {
    setStatus("Готово к работе.");
  } else {
    setStatus("Откройте дополнение в Microsoft Word.", true);
  }
});
