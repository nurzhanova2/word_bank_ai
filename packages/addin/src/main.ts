import type {
  ApiError,
  TransformAction,
  TransformResponse
} from "@bank-ai/contracts";
import "./styles.css";

const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;
const previewElement = document.querySelector<HTMLElement>("#preview")!;
const originalElement = document.querySelector<HTMLParagraphElement>("#original")!;
const resultElement = document.querySelector<HTMLParagraphElement>("#result")!;
const actionButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-action]")];
const acceptButton = document.querySelector<HTMLButtonElement>("#accept")!;
const rejectButton = document.querySelector<HTMLButtonElement>("#reject")!;

let pendingResult = "";

function setBusy(isBusy: boolean): void {
  actionButtons.forEach((button) => (button.disabled = isBusy));
  acceptButton.disabled = isBusy;
  rejectButton.disabled = isBusy;
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
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
    previewElement.hidden = true;
    setStatus("Обрабатываем выделенный текст…");

    const text = await getSelectedText();
    if (!text) {
      throw new Error("Сначала выделите текст в документе Word.");
    }

    const response = await fetch("/api/v1/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, text })
    });

    const body = (await response.json()) as TransformResponse | ApiError;
    if (!response.ok || "error" in body) {
      throw new Error("error" in body ? body.error.message : "Ошибка локального API.");
    }

    pendingResult = body.result;
    originalElement.textContent = text;
    resultElement.textContent = body.result;
    previewElement.hidden = false;
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
    previewElement.hidden = true;
    pendingResult = "";
    setStatus("Изменение применено к документу.");
  } catch {
    setStatus("Word не смог заменить выделенный текст.", true);
  } finally {
    setBusy(false);
  }
});

rejectButton.addEventListener("click", () => {
  previewElement.hidden = true;
  pendingResult = "";
  setStatus("Изменение отклонено. Документ не изменён.");
});

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    setStatus("Готово к работе.");
  } else {
    setStatus("Откройте дополнение в Microsoft Word.", true);
  }
});
