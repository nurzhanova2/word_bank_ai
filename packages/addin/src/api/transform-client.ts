import type { ApiError, TransformRequest, TransformResponse } from "@bank-ai/contracts";

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

export async function transformText(
  request: TransformRequest,
  fetcher: typeof fetch = fetch
): Promise<TransformResponse> {
  const response = await fetcher("/api/v1/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
