import type { ApiError, GrammarCheckResponse, TransformRequest, TransformResponse } from "@bank-ai/contracts";
export interface DocumentParagraph { id: string; index: number; text: string }
export interface DocumentTransformResponse { operationId: string; paragraphs: Array<DocumentParagraph & { original: string; result: string; changed: boolean }>; provider: string }
export type DocumentFinalizeResponse = DocumentTransformResponse | { operationId: string; kind: "summary"; summary: string };

export class TransformApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly operationId?: string
  ) {
    super(message);
    this.name = "TransformApiError";
  }
}

let sessionToken: string | undefined;
async function sessionHeaders(fetcher: typeof fetch): Promise<Record<string, string>> {
  if (!sessionToken) {
    const response = await fetcher("/session", { cache: "no-store" });
    if (!response.ok) throw new TransformApiError("Локальный сеанс Bank AI недоступен.", "UNAUTHORIZED", true);
    sessionToken = (await response.json() as { token?: string }).token;
  }
  return sessionToken ? { "X-Bank-AI-Session": sessionToken } : {};
}

export async function transformText(
  request: TransformRequest,
  fetcher: typeof fetch = fetch
): Promise<TransformResponse> {
  const response = await fetcher("/api/v1/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await sessionHeaders(fetcher) },
    body: JSON.stringify(request)
  });
  const body = (await response.json()) as TransformResponse | ApiError;
  if (!response.ok || "error" in body) {
    const error = "error" in body ? body.error : undefined;
    throw new TransformApiError(
      error?.message ?? "Локальный API вернул некорректный ответ.",
      error?.code ?? "API_ERROR",
      error?.retryable ?? false,
      error?.operationId
    );
  }
  return body;
}

export async function checkGrammar(text: string, fetcher: typeof fetch = fetch): Promise<GrammarCheckResponse> {
  const response = await fetcher("/api/v1/grammar/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await sessionHeaders(fetcher) },
    body: JSON.stringify({ text })
  });
  const body = await response.json() as GrammarCheckResponse | ApiError;
  if (!response.ok || "error" in body) {
    const error = "error" in body ? body.error : undefined;
    throw new TransformApiError(
      error?.message ?? "Сервис проверки грамматики вернул некорректный ответ.",
      error?.code ?? "GRAMMAR_API_ERROR",
      error?.retryable ?? false,
      error?.operationId
    );
  }
  return body;
}

export async function transformDocument(request: Omit<TransformRequest, "text"> & { paragraphs: DocumentParagraph[] }, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<DocumentTransformResponse> {
  const response = await fetcher("/api/v1/document/transform", { method: "POST", headers: { "Content-Type": "application/json", ...await sessionHeaders(fetcher) }, body: JSON.stringify(request), signal });
  const body = await response.json() as DocumentTransformResponse | ApiError;
  if (!response.ok || "error" in body) { const error = "error" in body ? body.error : undefined; throw new TransformApiError(error?.message ?? "Ошибка обработки документа.", error?.code ?? "API_ERROR", error?.retryable ?? false, error?.operationId); }
  return body;
}
async function documentRequest<T>(url: string, init: RequestInit, fetcher: typeof fetch, signal?: AbortSignal): Promise<T> {
  const response = await fetcher(url, { ...init, signal, headers: { "Content-Type": "application/json", ...await sessionHeaders(fetcher), ...init.headers } });
  const body = response.status === 204 ? undefined : await response.json() as T | ApiError;
  const apiError = typeof body === "object" && body !== null && "error" in body ? body as ApiError : undefined;
  if (!response.ok || apiError) { const error = apiError?.error; throw new TransformApiError(error?.message ?? "Ошибка операции документа.", error?.code ?? "API_ERROR", error?.retryable ?? true); }
  return body as T;
}
export const createDocumentOperation = (request: Omit<TransformRequest, "text"> & { paragraphs: DocumentParagraph[] }, fetcher: typeof fetch = fetch, signal?: AbortSignal) => documentRequest<{ operationId: string; totalChunks: number }>("/api/v1/document/operations", { method: "POST", body: JSON.stringify(request) }, fetcher, signal);
export const executeDocumentChunk = (id: string, index: number, fetcher: typeof fetch = fetch, signal?: AbortSignal) => documentRequest<{ chunkIndex: number; completed: number; total: number }>(`/api/v1/document/operations/${id}/chunks/${index}`, { method: "POST" }, fetcher, signal);
export const finalizeDocumentOperation = (id: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) => documentRequest<DocumentFinalizeResponse>(`/api/v1/document/operations/${id}/finalize`, { method: "POST" }, fetcher, signal);
export const cancelDocumentOperation = (id: string, fetcher: typeof fetch = fetch) => documentRequest<void>(`/api/v1/document/operations/${id}`, { method: "DELETE" }, fetcher);
