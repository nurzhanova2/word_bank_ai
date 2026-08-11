import type {
  ApiError,
  TargetLanguage,
  TargetTone,
  TransformAction,
  TransformRequest,
  TransformResponse
} from "@bank-ai/contracts";
import "./styles.css";

const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const statusHeadingElement = document.querySelector<HTMLElement>("#status-heading")!;
const statusCardElement = document.querySelector<HTMLElement>(".status-card")!;
const previewElement = document.querySelector<HTMLElement>("#preview")!;
const originalElement = document.querySelector<HTMLParagraphElement>("#original")!;
const resultElement = document.querySelector<HTMLParagraphElement>("#result")!;
const actionButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-action]")];
const translationLanguage = document.querySelector<HTMLSelectElement>("#translation-language")!;
const toneStyle = document.querySelector<HTMLSelectElement>("#tone-style")!;
const acceptButton = document.querySelector<HTMLButtonElement>("#accept")!;
const rejectButton = document.querySelector<HTMLButtonElement>("#reject")!;

let pendingResult = "";

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
  originalElement.textContent = "";
  resultElement.textContent = "";
  previewElement.hidden = false;
  previewElement.classList.add("is-empty");
  acceptButton.disabled = true;
  rejectButton.disabled = true;
}

function setBusy(isBusy: boolean): void {
  actionButtons.forEach((button) => (button.disabled = isBusy));
  translationLanguage.disabled = isBusy;
  toneStyle.disabled = isBusy;
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
    if (action === "translate") {
      payload.targetLanguage = translationLanguage.value as TargetLanguage;
    }
    if (action === "tone") {
      payload.targetTone = toneStyle.value as TargetTone;
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
    originalElement.textContent = text;
    renderHighlightedResult(text, body.result);
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
  if (!pendingResult) return;
  try {
    setBusy(true);
    await replaceSelection(pendingResult);
    resetPreview();
    setStatus("Изменение применено к документу.");
  } catch {
    setStatus("Word не смог заменить выделенный текст.", true);
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
